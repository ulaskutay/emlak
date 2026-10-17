/**
 * Video kuyruğu worker'ı (sunucuda, GPU'suz): panelden gelen siparişi üretim hattından geçirir.
 *
 *   pnpm worker   (DATABASE_URL, REDIS_URL, R2_*, RUNPOD_*, ELEVENLABS_* gerekli)
 *
 * Akış: video satırı → çevre bilgisi (önbellek) → produceReel (render RunPod'da) → R2'ye yükle → satırı güncelle.
 * Aşama ve ilerleme veritabanına yazılır; panel 3 sn'de bir okur.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextKey, eq, getDb, parcelContexts, videos } from "@arsa/db";
import { produceReel, type ReelStage } from "@arsa/drone-studio/pipeline";
import type { ParcelContext } from "@arsa/geo";
import { r2FromEnv } from "@arsa/providers";
import { Worker } from "bullmq";

const QUEUE = "reel";
const CONCURRENCY = Number(process.env.REEL_CONCURRENCY ?? 2);
const CACHE_DIR = process.env.REEL_CACHE_DIR ?? join(tmpdir(), "arsa-reel-cache");

const db = getDb();
const r2 = r2FromEnv();
if (!r2) throw new Error("R2 ayarları eksik: worker sonucu yükleyemez");

function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return { host: u.hostname, port: Number(u.port || 6379), username: u.username || undefined, password: u.password || undefined };
}

function ffmpeg(args: string[]) {
  return new Promise<void>((res, rej) => {
    const p = spawn("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
  });
}

async function processVideo(videoId: string) {
  const [v] = await db.select().from(videos).where(eq(videos.id, videoId));
  if (!v) throw new Error(`video yok: ${videoId}`);
  if (v.status === "done") return;
  const log = (m: string) => console.log(`[${videoId.slice(0, 8)}] ${m}`);
  await db.update(videos).set({ status: "running", stage: "parcel", progress: 0, error: null, startedAt: new Date(), attempts: v.attempts + 1 }).where(eq(videos.id, videoId));

  // Aşama değişimi hemen, aşama içi ilerleme en fazla 2 sn'de bir yazılır.
  let lastWrite = 0;
  let lastStage: ReelStage | null = null;
  const onStage = async (stage: ReelStage, progress: number) => {
    if (stage === lastStage && Date.now() - lastWrite < 2000) return;
    lastStage = stage;
    lastWrite = Date.now();
    await db.update(videos).set({ stage, progress }).where(eq(videos.id, videoId));
  };

  const ckey = contextKey(v.parcelSummary.centroid);
  const [cached] = await db.select().from(parcelContexts).where(eq(parcelContexts.key, ckey));
  const workDir = join(tmpdir(), "arsa-reel", videoId);
  await mkdir(workDir, { recursive: true });
  try {
    const r = await produceReel({
      parcelText: v.parcelText,
      context: (cached?.context as ParcelContext | undefined) ?? null,
      listing: v.listing,
      voiceId: v.voiceId ?? undefined,
      music: v.music,
      render: "runpod",
      workDir,
      cacheDir: CACHE_DIR,
      outputPrefix: `reels/${videoId}/render`,
      log,
      onStage,
    });
    if (!cached && r.context.pois.length) await db.insert(parcelContexts).values({ key: ckey, context: r.context }).onConflictDoNothing();

    // Kapak: kancanın göründüğü an (m² kartı ve neon çizgi).
    const poster = join(workDir, "poster.jpg");
    await ffmpeg(["-ss", "2.4", "-i", r.reelPath, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", poster]);
    const reelKey = `reels/${videoId}/reel.mp4`;
    const keyframeKey = `reels/${videoId}/poster.jpg`;
    await r2!.putFile(reelKey, r.reelPath, "video/mp4");
    await r2!.putFile(keyframeKey, poster, "image/jpeg");
    await db
      .update(videos)
      .set({
        status: "done",
        stage: "done",
        progress: 1,
        reelKey,
        keyframeKey,
        durationSec: r.durationSec,
        stats: { seconds: r.seconds, renderer: r.renderer, keyframes: r.keyframes },
        finishedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
    log(`hazır (${r.durationSec.toFixed(1)} sn video) · ${JSON.stringify(r.seconds)}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const worker = new Worker<{ videoId: string }>(
  QUEUE,
  async (job) => {
    try {
      await processVideo(job.data.videoId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${job.data.videoId.slice(0, 8)}] HATA: ${msg}`);
      await db.update(videos).set({ status: "failed", error: msg.slice(0, 1000), finishedAt: new Date() }).where(eq(videos.id, job.data.videoId));
      throw e;
    }
  },
  { connection: redisConnection(), concurrency: CONCURRENCY, lockDuration: 60_000 },
);
worker.on("ready", () => console.log(`Video worker hazır · kuyruk "${QUEUE}" · eşzamanlı ${CONCURRENCY}`));
// Bağlantı/kurulum hatası döngüye girerse log diski doldurmasın: art arda 20 hatada çık (Coolify yeniden başlatır).
let errorStreak = 0;
worker.on("error", (e) => {
  if (++errorStreak <= 3) console.error(`Worker hatası: ${e.message}`);
  if (errorStreak >= 20) {
    console.error("Art arda 20 hata: çıkılıyor");
    process.exit(1);
  }
});
worker.on("completed", () => (errorStreak = 0));

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, async () => {
    console.log("Kapanıyor (süren işler bitiriliyor)…");
    await worker.close();
    process.exit(0);
  });
