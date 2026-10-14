/**
 * Faz 0 benchmark: RunPod endpoint'inin gerçek hızını ölçer.
 *
 *   pnpm bench -- --image <url> --runs 5 --parallel 1 --quality preview --format reels_9x16
 *
 * Her iş için kuyruk bekleme (cold start dahil), GPU çalışma süresi ve worker içi zamanlamaları
 * kaydeder; p50/p95 özetini yazdırır ve bench/results/ altına JSON bırakır.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { MODEL_PROFILES, RunpodClient, RunpodVideoProvider, type ModelProfile } from "@arsa/providers";
import { OutputFormat, RenderQuality, type AiScene } from "@arsa/shared";
import { requireEnv } from "./env.js";

const { values: args } = parseArgs({
  // `pnpm bench -- --runs 1` çağrısında pnpm "--" ayracını da iletir; onu atla.
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    image: { type: "string", default: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600" },
    runs: { type: "string", default: "5" },
    parallel: { type: "string", default: "1" },
    quality: { type: "string", default: "preview" },
    format: { type: "string", default: "reels_9x16" },
    duration: { type: "string", default: "5" },
    warmup: { type: "boolean", default: false },
    steps: { type: "string" },
  },
});

const MODEL_PROFILE = (process.env.RUNPOD_MODEL_PROFILE ?? "hunyuan15_480p") as ModelProfile;
if (!(MODEL_PROFILE in MODEL_PROFILES)) throw new Error(`Bilinmeyen RUNPOD_MODEL_PROFILE: ${MODEL_PROFILE}`);

const client = new RunpodClient(requireEnv("RUNPOD_API_KEY"), requireEnv("RUNPOD_VIDEO_ENDPOINT_ID"));
const provider = new RunpodVideoProvider(client, MODEL_PROFILE);
const RESULTS_DIR = new URL("../../../bench/results/", import.meta.url);
// Ctrl+C ile durdurulursa RunPod'da çalışan işler de iptal edilsin (yoksa GPU ücreti devam eder).
const activeJobs = new Set<string>();
process.on("SIGINT", async () => {
  console.log(`\nDurduruldu, ${activeJobs.size} iş iptal ediliyor...`);
  await Promise.allSettled([...activeJobs].map((id) => client.cancel(id)));
  process.exit(130);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RunResult {
  run: number;
  ok: boolean;
  wallSeconds: number;
  queueSeconds?: number;
  executionSeconds?: number;
  workerTimings?: Record<string, number>;
  gpu?: string;
  peakVramGb?: number;
  videoUrl?: string;
  error?: string;
}

async function runOne(i: number): Promise<RunResult> {
  const scene: AiScene = {
    id: `bench-${Date.now()}-${i}`,
    type: "ai_photo_motion",
    durationSec: Number(args.duration),
    photoUrl: args.image!,
    camera: "slow_push_in",
    setting: "exterior",
    prompt: "A wide open plot of land under a clear sky at golden hour.",
  };
  const t0 = Date.now();
  const job = await provider.submit({
    projectId: "bench",
    scene,
    format: OutputFormat.parse(args.format),
    quality: RenderQuality.parse(args.quality),
    seed: i,
    numSteps: args.steps ? Number(args.steps) : undefined,
  });
  activeJobs.add(job.externalId);
  console.log(`#${i} gönderildi: ${job.externalId}`);
  for (;;) {
    await sleep(1500);
    const raw = await client.status(job.externalId);
    if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(raw.status)) {
      activeJobs.delete(job.externalId);
      let videoUrl = raw.output?.video_url;
      if (raw.output?.video_base64) {
        // R2 kurulu değilken worker videoyu base64 döndürür; incelemek için diske yaz.
        await mkdir(RESULTS_DIR, { recursive: true });
        const file = new URL(`${scene.id}.mp4`, RESULTS_DIR);
        await writeFile(file, Buffer.from(raw.output.video_base64, "base64"));
        videoUrl = file.pathname;
      }
      return {
        run: i,
        ok: raw.status === "COMPLETED",
        wallSeconds: (Date.now() - t0) / 1000,
        queueSeconds: raw.delayTime !== undefined ? raw.delayTime / 1000 : undefined,
        executionSeconds: raw.executionTime !== undefined ? raw.executionTime / 1000 : undefined,
        workerTimings: raw.output?.timings,
        gpu: raw.output?.gpu,
        peakVramGb: raw.output?.peak_vram_gb,
        videoUrl,
        error: raw.error ?? raw.output?.error,
      };
    }
  }
}

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
}

const health = await client.health();
console.log("Endpoint durumu (başlangıç):", JSON.stringify(health.workers));
if (args.warmup) {
  console.log("Isıtma işi gönderiliyor...");
  await client.warmup();
}

const runs = Number(args.runs);
const parallel = Number(args.parallel);
const results: RunResult[] = [];
for (let i = 0; i < runs; i += parallel) {
  const batch = Array.from({ length: Math.min(parallel, runs - i) }, (_, k) => runOne(i + k));
  for (const r of await Promise.all(batch)) {
    results.push(r);
    console.log(
      `#${r.run} ${r.ok ? "OK " : "HATA"} toplam=${r.wallSeconds.toFixed(1)}s kuyruk=${r.queueSeconds?.toFixed(1)}s ` +
        `gpu=${r.executionSeconds?.toFixed(1)}s [${r.gpu ?? "?"}, peak ${r.peakVramGb ?? "?"} GB] ${r.workerTimings ? JSON.stringify(r.workerTimings) : ""} ${r.error ?? ""}`,
    );
  }
}

const ok = results.filter((r) => r.ok);
const summary = {
  params: args,
  startWorkers: health.workers,
  success: `${ok.length}/${results.length}`,
  wall: { p50: pct(ok.map((r) => r.wallSeconds), 50), p95: pct(ok.map((r) => r.wallSeconds), 95) },
  queue: { p50: pct(ok.map((r) => r.queueSeconds ?? 0), 50), p95: pct(ok.map((r) => r.queueSeconds ?? 0), 95) },
  gpu: { p50: pct(ok.map((r) => r.executionSeconds ?? 0), 50), p95: pct(ok.map((r) => r.executionSeconds ?? 0), 95) },
};
console.log("\nÖzet:", JSON.stringify(summary, null, 2));

await mkdir(RESULTS_DIR, { recursive: true });
await writeFile(new URL(`bench-${Date.now()}.json`, RESULTS_DIR), JSON.stringify({ summary, results }, null, 2));
