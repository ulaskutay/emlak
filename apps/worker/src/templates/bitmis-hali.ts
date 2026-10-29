/**
 * Arsanın bitmiş hali: parselin drone çekimi (seslendirmesiz, RunPod) → son kareye yapı eklenir (Higgsfield
 * Nano Banana 2.1) → Kling 4.0 ilk/son kare inşaat timelapse'i → drone + inşaat + kapanış kartı + müzik.
 * (Arsadan inşaat videosu ayrı hat: insaat-videosu.ts.)
 */
import { join } from "node:path";
import { produceReel } from "@arsa/drone-studio/pipeline";
import { HiggsfieldCli } from "@arsa/providers";
import { buildingSpec, constructionPrompt, FORMAT_SPECS, type BuildingType } from "@arsa/shared";
import {
  addMusic,
  backgroundMusic,
  CLIP_FPS,
  download,
  drawText,
  ffmpeg,
  priceText,
  probeDuration,
  upscale,
  type JobContext,
  type JobResult,
} from "./common.js";

const OUT_FPS = CLIP_FPS;
const OUTRO_SECONDS = 3;
/** İnşaat klibi (Kling 4.0 720p → 1080p 60 FPS AIGC büyütme): aşamalar okunsun diye 6 sn. */
const CLIP_SECONDS = 6;

export const bitmisHali = (ctx: JobContext) => construction(ctx, true);

async function construction(ctx: JobContext, endFrame: boolean): Promise<JobResult> {
  const v = ctx.video;
  if (!v.parcelText || !v.parcelSummary) throw new Error("Parsel dosyası eksik");
  const { building, floors } = v.input as { building?: BuildingType; floors?: number };
  if (!building) throw new Error("Yapı tipi eksik");
  const spec = buildingSpec(building, floors ?? 4);

  const hf = new HiggsfieldCli();
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

  // 2) Bitiş karesi: parselin içine yapı (yalnız bitmiş hali); başlangıç karesiyle aynı boyuta kırpılır.
  let end: string | undefined;
  if (endFrame) {
    await ctx.stage("build");
    const edit = await hf.generate(
      "nano_banana_2_1",
      {
        params: {
          aspect_ratio: "9:16",
          resolution: "2k",
          seed: 7,
          prompt:
            `Add ${spec.edit}, built exactly inside the glowing outlined plot. ` +
            "The building sits on the ground within the outline and matches the aerial camera perspective, scale, shadows and sunlight of the photo. " +
            "Keep the glowing outline visible. Keep everything outside the outline exactly unchanged: roads, trees, neighboring buildings. Photorealistic aerial drone photo.",
        },
        media: [["image", start]],
      },
      { label: "bitiş karesi", log: ctx.log },
    );
    const raw = await download(edit.url, join(ctx.workDir, "bitis-ham.png"));
    end = join(ctx.workDir, "bitis.png");
    await ffmpeg(["-i", raw, "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, "-frames:v", "1", end]);
  }

  // 3) İnşaat timelapse'i. Bitiş karesi yoksa bina tarifi prompt'ta ayrıntılı olmalı: model yapıyı yalnız buradan bilir.
  await ctx.stage("timelapse");
  const timelapse = await hf.generate(
    "kling4_0",
    {
      params: { prompt: constructionPrompt(spec.edit, !end), mode: "image-to-video", duration: CLIP_SECONDS, resolution: "720p", aspect_ratio: "9:16" },
      media: [["start-image", start], ...(end ? [["end-image", end] as [string, string]] : [])],
    },
    { label: "inşaat", log: ctx.log },
  );
  const clip = await upscale(hf, timelapse.id, join(ctx.workDir, "insaat.mp4"), "büyütme: inşaat", ctx.log);

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
