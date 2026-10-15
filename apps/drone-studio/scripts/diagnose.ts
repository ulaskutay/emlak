/**
 * Worker ortamı tanısı: Chrome'un hangi WebGL arka ucuyla çalıştığını ve stüdyonun her adımının
 * süresini ölçer. RunPod'da handler `diagnose: true` ile çağırır; sonuç son satırda JSON.
 *
 *   tsx scripts/diagnose.ts --in parcel.geojson --out /tmp/diag
 */
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel } from "@arsa/geo";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { chromeArgs, withTimeout, type GlMode } from "./render.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: { in: { type: "string" }, out: { type: "string" }, context: { type: "string" }, port: { type: "string", default: "5178" } },
});
if (!args.in || !args.out) throw new Error("--in ve --out gerekli");
await mkdir(args.out, { recursive: true });
const key = process.env.GOOGLE_MAPS_API_KEY ?? "";
const log = (m: string) => console.error(`[tanı] ${m}`);
const report: Record<string, unknown> = { platform: process.platform, hasKey: !!key };
const t00 = Date.now();
const since = () => `${((Date.now() - t00) / 1000).toFixed(1)} sn`;
log(`başladı · node ${process.version}`);

// 1) Her WebGL arka ucu için: Chrome açılıyor mu, WebGL hangi çiziciyle çalışıyor?
const modes: GlMode[] = ["egl", "vulkan", "swiftshader"];
const gl: Record<string, unknown> = {};
for (const mode of modes) {
  const t = Date.now();
  log(`${mode}: Chrome açılıyor (${since()})`);
  try {
    const b = await withTimeout(chromium.launch({ channel: "chrome", headless: true, args: chromeArgs(mode) }), 30000, "launch");
    const p = await b.newPage();
    await p.setContent("<canvas></canvas>");
    const info = await withTimeout(
      p.evaluate(() => {
        const g = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
        if (!g) return { webgl2: false };
        const ext = g.getExtension("WEBGL_debug_renderer_info");
        return { webgl2: true, renderer: ext ? String(g.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "?" };
      }),
      15000,
      "webgl",
    );
    gl[mode] = { ok: true, ms: Date.now() - t, ...info };
    b.close().catch(() => {});
  } catch (e) {
    gl[mode] = { ok: false, ms: Date.now() - t, error: String(e).slice(0, 400) };
  }
  const g = gl[mode] as { ok: boolean; ms: number; renderer?: string; error?: string };
  log(`${mode}: ${g.ok ? "açıldı" : "HATA"} ${g.ms} ms · ${g.renderer ?? g.error ?? ""}`);
}
report.gl = gl;

// 2) Stüdyo: en iyi arka uçla sayfa → Google Maps → harita hazır adımları
const best = (["egl", "vulkan"] as GlMode[]).find((m) => {
  const r = gl[m] as { ok?: boolean; renderer?: string } | undefined;
  return r?.ok && r.renderer && !/swiftshader|llvmpipe/i.test(r.renderer);
}) ?? "swiftshader";
report.chosen = best;
const steps: Record<string, number | string> = {};
const consoleLines: string[] = [];
log(`seçilen: ${best} · vite başlıyor (${since()})`);
const server = await createServer({ root: join(import.meta.dirname, ".."), configFile: join(import.meta.dirname, "../vite.config.ts"), logLevel: "warn", server: { port: Number(args.port), strictPort: true, watch: null } });
await server.listen();
log(`vite hazır (${since()})`);
const browser = await withTimeout(chromium.launch({ channel: "chrome", headless: true, args: chromeArgs(best) }), 30000, "launch");
log(`chrome açıldı (${since()})`);
try {
  let t = Date.now();
  const cached = args.context ? JSON.parse(await readFile(args.context, "utf8")) : null;
  const parcel = await prepareParcel(await readFile(args.in, "utf8"), { cached });
  steps.prepare = Date.now() - t;
  log(`parsel hazır ${steps.prepare} ms (${since()})`);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on("console", (m) => {
    consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300));
    if (m.type() === "error" || m.type() === "warning") log(`konsol ${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => consoleLines.push(`pageerror: ${e.message}`.slice(0, 300)));
  page.on("crash", () => consoleLines.push("SAYFA ÇÖKTÜ"));
  t = Date.now();
  await withTimeout(page.goto(server.resolvedUrls?.local[0] ?? "http://localhost:5178/"), 60000, "goto");
  steps.goto = Date.now() - t;
  log(`sayfa yüklendi ${steps.goto} ms (${since()}) · harita yükleniyor`);
  t = Date.now();
  try {
    await withTimeout(page.evaluate(([p, k]) => (window as any).studio.loadParcel(p, k), [parcel, key] as const), 120000, "loadParcel");
    steps.loadParcel = Date.now() - t;
    log(`harita hazır ${steps.loadParcel} ms (${since()})`);
  } catch (e) {
    steps.loadParcel = `HATA: ${String(e).slice(0, 300)}`;
    log(`harita HATA: ${String(e).slice(0, 200)}`);
    steps.mapStatus = await page.evaluate(() => document.getElementById("status")?.textContent ?? "").catch(() => "?");
  }
  await page.screenshot({ path: join(args.out, "diag.jpg"), type: "jpeg", quality: 70 }).catch(() => {});
  steps.shm = await import("node:fs").then((fs) => {
    try {
      return String(fs.statfsSync("/dev/shm").blocks * fs.statfsSync("/dev/shm").bsize);
    } catch {
      return "?";
    }
  });
} finally {
  await withTimeout(browser.close(), 15000, "Chrome kapanışı").catch((e) => log(`uyarı: ${e.message}`));
  await withTimeout(server.close(), 5000, "Vite kapanışı").catch(() => {});
}
report.steps = steps;
report.console = consoleLines.slice(-40);
report.screenshot = join(args.out, "diag.jpg");
console.log(JSON.stringify(report));
log(`bitti (${since()})`);
process.exit(0); // açık kalan tarayıcı süreçleri/zamanlayıcılar çıkışı bekletmesin
