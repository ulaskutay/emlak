/**
 * İnşaat şablonları: parselin drone çekimi (seslendirmesiz) → son kareden Wan 2.2 inşaat timelapse'i
 * → drone + inşaat + kapanış kartı + müzik.
 *   bitmis-hali:    son kareye AI ile yapı eklenir (Qwen-Image-Edit), Wan ilk/son kare arasında geçiş yapar.
 *   insaat-videosu: bitiş karesi yok; Wan yalnız ilk kare + prompt'la inşaatı kendisi kurar (daha hızlı ve ucuz).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { produceReel } from "@arsa/drone-studio/pipeline";
import { RunpodClient } from "@arsa/providers";
import { buildingSpec, constructionPrompt, FORMAT_SPECS, type BuildingType } from "@arsa/shared";
import {
  addMusic,
  backgroundMusic,
  download,
  drawText,
  ffmpeg,
  priceText,
  probeDuration,
  runpodJob,
  saveOutput,
  type JobContext,
  type JobResult,
} from "./common.js";

const OUT_FPS = 30;
const OUTRO_SECONDS = 3;

export const bitmisHali = (ctx: JobContext) => construction(ctx, true);
export const insaatVideosu = (ctx: JobContext) => construction(ctx, false);

async function construction(ctx: JobContext, endFrame: boolean): Promise<JobResult> {
  const v = ctx.video;
  if (!v.parcelText || !v.parcelSummary) throw new Error("Parsel dosyası eksik");
  const { building, floors } = v.input as { building?: BuildingType; floors?: number };
  if (!building) throw new Error("Yapı tipi eksik");
  const spec = buildingSpec(building, floors ?? 4);

  const apiKey = process.env.RUNPOD_API_KEY;
  const qwenId = process.env.RUNPOD_QWEN_ENDPOINT_ID;
  const wanId = process.env.RUNPOD_WAN_ENDPOINT_ID;
  if (!apiKey || !wanId || (endFrame && !qwenId)) throw new Error("RUNPOD_QWEN_ENDPOINT_ID / RUNPOD_WAN_ENDPOINT_ID eksik");
  const { width: W, height: H } = FORMAT_SPECS.reels_9x16;

  // 1) Drone çekimi: arsa hattı seslendirmesiz; son kare (parsel çizgili) inşaatın başlangıcı.
  const r = await produceReel({
    parcelText: v.parcelText,
    listing: { ...v.listing, pois: [] },
    voice: false,
    music: false,
    render: "runpod",
    workDir: ctx.workDir,
    cacheDir: ctx.cacheDir,
    outputPrefix: `reels/${v.id}/render`,
    log: ctx.log,
    onStage: (s, p) => (s === "parcel" || s === "render" ? ctx.stage(s, p) : undefined),
  });
  const kf = r.keyframes?.neon;
  const kfUrl = kf?.url ?? (kf?.key ? await ctx.r2.url(kf.key, 3600) : undefined);
  if (!kfUrl) throw new Error("Drone çekiminin son karesi alınamadı");
  const start = await download(kfUrl, join(ctx.workDir, "baslangic.png"));
  const startData = `data:image/png;base64,${(await readFile(start)).toString("base64")}`;

  // 2) Bitiş karesi: parselin içine yapı (yalnız bitmiş hali)
  let endData: string | undefined;
  if (endFrame) {
    await ctx.stage("build");
    const qwen = await runpodJob(
      new RunpodClient(apiKey, qwenId!),
      {
        image_url: startData,
        width: W,
        height: H,
        seed: 7,
        prompt:
          `Add ${spec.edit}, built exactly inside the glowing outlined plot. ` +
          "The building sits on the ground within the outline and matches the aerial camera perspective, scale, shadows and sunlight of the photo. " +
          "Keep the glowing outline visible. Keep everything outside the outline exactly unchanged: roads, trees, neighboring buildings. Photorealistic aerial drone photo.",
      },
      "bitiş karesi",
      ctx.log,
    );
    const end = await saveOutput(qwen, "image", join(ctx.workDir, "bitis.png"));
    endData = `data:image/png;base64,${(await readFile(end)).toString("base64")}`;
  }

  // 3) İnşaat timelapse'i. Bitiş karesi yoksa bina tarifi prompt'ta ayrıntılı olmalı: model yapıyı yalnız buradan bilir.
  await ctx.stage("timelapse");
  const wan = await runpodJob(
    new RunpodClient(apiKey, wanId),
    {
      image_url: startData,
      ...(endData && { last_image_url: endData }),
      width: 480,
      height: 832,
      num_frames: 81, // Wan 16 fps → ~5 sn
      frame_rate: 16,
      num_steps: 4,
      output_width: W,
      output_height: H,
      seed: 7,
      prompt: constructionPrompt(spec.edit, !endData),
    },
    "inşaat",
    ctx.log,
  );
  const clip = await saveOutput(wan, "video", join(ctx.workDir, "insaat.mp4"));

  // 4) Kurgu
  await ctx.stage("compose");
  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);
  const outro = [priceText(v.listing.priceTry) ?? `${Math.round(v.parcelSummary.areaM2).toLocaleString("tr-TR")} m²`, spec.label, v.listing.officeName, v.listing.phone].filter(
    Boolean,
  ) as string[];
  const lineH = Math.round(titleSize * 1.5);
  const top = Math.round(H / 2 - (outro.length * lineH) / 2);
  const filters = [
    `[0:v]scale=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p[v0]`,
    `[1:v]scale=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
      `${drawText(spec.label, titleSize, "h*0.10", "white", 0.3)},` +
      `${drawText("Temsili görseldir", Math.round(subSize * 0.7), "h*0.93", "white@0.8")}[v1]`,
    `color=c=0x121a16:s=${W}x${H}:r=${OUT_FPS}:d=${OUTRO_SECONDS},format=yuv420p,` +
      outro.map((l, i) => drawText(l, i === 0 ? titleSize : subSize, String(top + i * lineH), i === 0 ? "0xFFC24D" : "white", i * 0.2)).join(",") +
      "[v2]",
    "[v0][v1][v2]concat=n=3:v=1:a=0[out]",
  ];
  const silent = join(ctx.workDir, "bitmis-sessiz.mp4");
  await ffmpeg([
    "-i", r.droneVideoPath, "-i", clip,
    "-filter_complex", filters.join(";"), "-map", "[out]",
    "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);
  const music = v.music ? await backgroundMusic(duration, ctx) : null;
  const final = await addMusic(silent, music, duration, join(ctx.workDir, "bitmis.mp4"));
  return { videoPath: final, durationSec: duration, posterAt: Math.max(0, duration - OUTRO_SECONDS - 0.5), stats: { building, floors, renderer: r.renderer } };
}
