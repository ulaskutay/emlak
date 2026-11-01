/**
 * Video kuyruğu worker'ı (sunucuda, GPU'suz): panelden gelen siparişi şablonunun üretim hattından geçirir.
 *
 *   pnpm worker   (DATABASE_URL, REDIS_URL, R2_*, RUNPOD_*, ELEVENLABS_* gerekli)
 *
 * Akış: video satırı → şablon hattı (templates/) → kapak karesi → R2'ye yükle → satırı güncelle.
 * Aşama ve ilerleme veritabanına yazılır; panel 3 sn'de bir okur.
 *
 * Ara dosyalar (workDir) yalnız başarıda silinir: hatadan ya da yeniden başlatmadan sonra yeniden denemede
 * Higgsfield/Kling çıktıları yeniden üretilmez (hat var olan dosyayı atlar). 3 günden eski klasörler açılışta silinir.
 */
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, getDb, refundVideoCredits, videos } from "@arsa/db";
import { r2FromEnv } from "@arsa/providers";
import type { TemplateId, VideoPreview } from "@arsa/shared";
import { Worker } from "bullmq";
import { arsaDrone } from "./templates/arsa-drone.js";
import { bitmisHali } from "./templates/bitmis-hali.js";
import { ffmpeg, type JobContext, type JobResult } from "./templates/common.js";
import { dosenmisEv } from "./templates/dosenmis-ev.js";
import { ilanVideosu } from "./templates/ilan-videosu.js";
import { insaatVideosu } from "./templates/insaat-videosu.js";
import { sunucuEv } from "./templates/sunucu-ev.js";

const QUEUE = "reel";
const CONCURRENCY = Number(process.env.REEL_CONCURRENCY ?? 2);
const CACHE_DIR = process.env.REEL_CACHE_DIR ?? join(tmpdir(), "arsa-reel-cache");
const WORK_ROOT = join(tmpdir(), "arsa-reel");

const PIPELINES: Record<TemplateId, (ctx: JobContext) => Promise<JobResult>> = {
  "arsa-drone": arsaDrone,
  "ilan-videosu": ilanVideosu,
  "bitmis-hali": bitmisHali,
  "insaat-videosu": insaatVideosu,
  "dosenmis-ev": dosenmisEv,
  "sunucu-ev": sunucuEv,
};

const db = getDb();
const r2 = r2FromEnv();
if (!r2) throw new Error("R2 ayarları eksik: worker sonucu yükleyemez");

function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return { host: u.hostname, port: Number(u.port || 6379), username: u.username || undefined, password: u.password || undefined };
}

async function processVideo(videoId: string) {
  const [v] = await db.select().from(videos).where(eq(videos.id, videoId));
  if (!v) throw new Error(`video yok: ${videoId}`);
  // failed: kuyrukta beklerken yönetici iptal etti (yeniden deneme önce queued yapar).
  if (v.status === "done" || v.status === "failed") return;
  const pipeline = PIPELINES[v.template];
  if (!pipeline) throw new Error(`Bilinmeyen şablon: ${v.template}`);
  const log = (m: string) => console.log(`[${videoId.slice(0, 8)} ${v.template}] ${m}`);
  await db
    .update(videos)
    .set({ status: "running", stage: null, progress: 0, error: null, stats: null, startedAt: new Date(), attempts: v.attempts + 1 })
    .where(eq(videos.id, videoId));

  // Aşama değişimi hemen, aşama içi ilerleme en fazla 2 sn'de bir yazılır.
  let lastWrite = 0;
  let lastStage: string | null = null;
  const stage = async (s: string, progress = 0) => {
    if (s === lastStage && Date.now() - lastWrite < 2000) return;
    lastStage = s;
    lastWrite = Date.now();
    await db.update(videos).set({ stage: s, progress }).where(eq(videos.id, videoId));
  };

  const workDir = join(WORK_ROOT, videoId);
  await mkdir(workDir, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  // Panelde üretim sürerken gösterilen ara çıktılar (stats.previews): küçük JPEG ya da 8 sn'lik sessiz 360p klip.
  const previews: VideoPreview[] = [];
  let previewNo = 0;
  const preview = async (file: string, label: string) => {
    const n = ++previewNo;
    const kind = file.endsWith(".mp4") ? "video" : "image";
    const small = join(workDir, `onizleme-${n}.${kind === "video" ? "mp4" : "jpg"}`);
    try {
      if (kind === "video")
        await ffmpeg(["-t", "8", "-i", file, "-an", "-vf", "scale=360:-2,fps=30", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", small]);
      else await ffmpeg(["-i", file, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", small]);
      const key = `reels/${videoId}/onizleme/${n}.${kind === "video" ? "mp4" : "jpg"}`;
      await r2!.putFile(key, small, kind === "video" ? "video/mp4" : "image/jpeg");
      previews.push({ key, kind, label });
      await db.update(videos).set({ stats: { previews } }).where(and(eq(videos.id, videoId), eq(videos.status, "running")));
    } catch (e) {
      log(`! önizleme yüklenemedi (${label}): ${String(e).slice(0, 160)}`);
    }
  };

  const r = await pipeline({ video: v, r2: r2!, workDir, cacheDir: CACHE_DIR, log, stage, preview });
  const poster = join(workDir, "poster.jpg");
  await ffmpeg(["-ss", String(r.posterAt), "-i", r.videoPath, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", poster]);
  const reelKey = `reels/${videoId}/reel.mp4`;
  const keyframeKey = `reels/${videoId}/poster.jpg`;
  await r2!.putFile(reelKey, r.videoPath, "video/mp4");
  await r2!.putFile(keyframeKey, poster, "image/jpeg");
  await db
    .update(videos)
    .set({ status: "done", stage: "done", progress: 1, reelKey, keyframeKey, durationSec: r.durationSec, stats: { ...r.stats, previews }, finishedAt: new Date() })
    // Üretim sürerken yönetici iptal ettiyse iptal kalır.
    .where(and(eq(videos.id, videoId), eq(videos.status, "running")));
  log(`hazır (${r.durationSec.toFixed(1)} sn video)`);
  await rm(workDir, { recursive: true, force: true });
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
      // Video çıkmadı: kredi kullanıcıya döner (yönetici yeniden üretirse yeniden düşülür).
      await refundVideoCredits(db, job.data.videoId, { note: "Üretim hatası" }).catch((err) => console.error(`İade yapılamadı: ${err}`));
      throw e;
    }
  },
  // maxStalledCount: worker yeniden başlatılınca (yükleme) yarım iş baştan alınır; ara dosyalar durduğu için ucuz.
  { connection: redisConnection(), concurrency: CONCURRENCY, lockDuration: 60_000, maxStalledCount: 3 },
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
// İş hattı dışında düşen iş (art arda yeniden başlatmada "stalled" sınırı): satır "running" kalıp panelde asılı durmasın.
worker.on("failed", async (job, e) => {
  const id = job?.data.videoId;
  if (!id) return;
  const [v] = await db.select({ status: videos.status }).from(videos).where(eq(videos.id, id));
  if (v?.status !== "running" && v?.status !== "queued") return;
  console.error(`[${id.slice(0, 8)}] kuyrukta düştü: ${e.message}`);
  await db.update(videos).set({ status: "failed", error: `Üretim yarıda kaldı: ${e.message}`.slice(0, 1000), finishedAt: new Date() }).where(eq(videos.id, id));
  await refundVideoCredits(db, id, { note: "Üretim hatası" }).catch((err) => console.error(`İade yapılamadı: ${err}`));
});

// Yarım kalmış işlerin eski ara dosyaları.
for (const d of await readdir(WORK_ROOT).catch(() => [] as string[])) {
  const p = join(WORK_ROOT, d);
  const s = await stat(p).catch(() => null);
  if (s && Date.now() - s.mtimeMs > 3 * 86400_000) await rm(p, { recursive: true, force: true });
}

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, async () => {
    console.log("Kapanıyor (süren işler bitiriliyor)…");
    await worker.close();
    process.exit(0);
  });
