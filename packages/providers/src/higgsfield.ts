import { spawn } from "node:child_process";

/**
 * Higgsfield, `higgsfield` CLI üzerinden (plan kredisiyle; resmi API ayrı, dolar bakiyeli ve daha pahalı).
 * CLI'ın oturumu sunucuda bir kez `higgsfield auth login` ile açılır, worker'ı çalıştıran kullanıcının
 * ~/.config/higgsfield/credentials.json dosyasında durur ve kendiliğinden yenilenir.
 *
 * Plan aynı anda en fazla 8 iş kabul eder (Plus); fazlası "rate_limit_reached" ile döner. Süreç içinde
 * HIGGSFIELD_CONCURRENCY kadar iş aynı anda gönderilir, sınıra takılan iş bekleyip yeniden denenir; geçici 5xx ve
 * ağ hataları da birkaç kez yeniden denenir.
 */
export interface HiggsfieldJob {
  id: string;
  status: string;
  result_url?: string | null;
}

export interface HiggsfieldInput {
  /** Model parametreleri (`--prompt`, `--duration`…), CLI'a `--ad değer` olarak geçer. */
  params: Record<string, string | number | boolean | undefined>;
  /** Medya: `--start-image`, `--image` gibi bayraklar; değer yerel dosya yolu ya da yükleme/iş kimliği. Tekrarlanabilir. */
  media?: [flag: string, value: string][];
}

const DONE = "completed";
const FAILED = new Set(["failed", "nsfw", "canceled", "cancelled", "error"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HiggsfieldCli {
  private running = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private readonly bin = process.env.HIGGSFIELD_BIN || "higgsfield",
    private readonly concurrency = Number(process.env.HIGGSFIELD_CONCURRENCY ?? 4),
  ) {}

  private run(args: string[], timeoutMs = 120_000) {
    return new Promise<string>((res, rej) => {
      const out: string[] = [];
      const err: string[] = [];
      const p = spawn(this.bin, [...args, "--json", "--no-color"], { stdio: ["ignore", "pipe", "pipe"] });
      const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
      p.stdout.on("data", (d) => out.push(String(d)));
      p.stderr.on("data", (d) => err.push(String(d)));
      p.on("error", (e) => (clearTimeout(timer), rej(new Error(`higgsfield çalıştırılamadı: ${e.message}`))));
      p.on("close", (c) => {
        clearTimeout(timer);
        const text = out.join("");
        if (c === 0) return res(text);
        rej(new Error(`higgsfield ${args.slice(0, 2).join(" ")} → ${c}: ${(err.join("") || text).trim().slice(0, 600)}`));
      });
    });
  }

  private async slot() {
    if (this.running < this.concurrency) return void this.running++;
    await new Promise<void>((r) => this.waiting.push(r));
    this.running++;
  }

  private release() {
    this.running--;
    this.waiting.shift()?.();
  }

  /** İşi gönderir (plan sınırına takılırsa bekleyip yeniden dener), iş kimliğini döner. */
  async submit(model: string, input: HiggsfieldInput): Promise<string> {
    const args = ["generate", "create", model];
    for (const [k, v] of Object.entries(input.params)) if (v !== undefined) args.push(`--${k}`, String(v));
    for (const [flag, value] of input.media ?? []) args.push(`--${flag}`, value);
    for (let attempt = 0; ; attempt++) {
      try {
        const ids = JSON.parse(await this.run(args)) as string[];
        if (!ids[0]) throw new Error("higgsfield iş kimliği dönmedi");
        return ids[0];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/rate_limit_reached/.test(msg) && attempt < 40) {
          await sleep(15_000);
          continue;
        }
        // Geçici sunucu/ağ hatası (ör. medya yüklemede "HTTP 520"): artan beklemeyle birkaç kez daha denenir.
        if (/HTTP 5\d\d|: 5\d\d\b|ECONNRESET|ETIMEDOUT|socket hang up|timeout/i.test(msg) && attempt < 4) {
          await sleep((attempt + 1) * 10_000);
          continue;
        }
        throw e;
      }
    }
  }

  async get(id: string): Promise<HiggsfieldJob> {
    const raw = JSON.parse(await this.run(["generate", "get", id])) as HiggsfieldJob | HiggsfieldJob[];
    return Array.isArray(raw) ? raw[0]! : raw;
  }

  /** İşi gönderip bitene kadar bekler; sonuç dosyasının linkini döner. Eşzamanlılık sınırı içinde sıraya girer. */
  async generate(model: string, input: HiggsfieldInput, opts: { label?: string; log?: (m: string) => void; timeoutMs?: number } = {}) {
    const label = opts.label ?? model;
    await this.slot();
    try {
      const t0 = Date.now();
      const id = await this.submit(model, input);
      opts.log?.(`[${label}] gönderildi: ${id}`);
      const deadline = t0 + (opts.timeoutMs ?? 25 * 60_000);
      for (;;) {
        await sleep(5000);
        const job = await this.get(id).catch((e) => {
          // Ağ ya da oturum yenileme anlık hatası: işi kaybetmeden yeniden sorulur.
          opts.log?.(`[${label}] durum okunamadı: ${String(e).slice(0, 160)}`);
          return null;
        });
        if (job?.status === DONE && job.result_url) {
          opts.log?.(`[${label}] tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
          return { id, url: job.result_url };
        }
        if (job && FAILED.has(job.status)) throw new Error(`${label} başarısız (${job.status})`);
        if (Date.now() > deadline) throw new Error(`${label} zaman aşımı (${id})`);
      }
    } finally {
      this.release();
    }
  }

  async credits(): Promise<number> {
    return (JSON.parse(await this.run(["account", "status"])) as { credits: number }).credits;
  }
}
