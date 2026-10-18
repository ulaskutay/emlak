/**
 * Fotoğraftan ilan videosu: her fotoğraf RunPod'da (Hunyuan/LTX) kamera hareketli bir sahneye dönüşür,
 * sahneler paralel üretilir, başlıklar ve kapanış kartıyla birleştirilip müzik eklenir.
 */
import { join } from "node:path";
import { MODEL_PROFILES, RunpodClient, RunpodVideoProvider, type ModelProfile } from "@arsa/providers";
import { FORMAT_SPECS, type AiScene, type CameraMove, type IlanPhoto } from "@arsa/shared";
import { addMusic, backgroundMusic, drawText, ffmpeg, priceText, runpodJob, saveOutput, type JobContext, type JobResult } from "./common.js";

const FORMAT = "reels_9x16" as const;
const SCENE_SECONDS = 3.375; // 81 kare / 24 fps
const OUTRO_SECONDS = 3;
const OUT_FPS = 30;

/** Fotoğraf sırasına göre kamera: dış mekânda havadan/yörünge, iç mekânda yaklaşma/kaydırma. */
const EXTERIOR: CameraMove[] = ["drone_rise", "orbit_right", "slow_pull_out", "orbit_left"];
const INTERIOR: CameraMove[] = ["slow_push_in", "pan_right", "slow_push_in", "pan_left"];

/** Fotoğrafa özel tarif yerine sabit sahne tarifi; mimariyi sabit tutan kısım buildRealEstatePrompt'ta. */
const SCENE_PROMPT = {
  exterior: "A real estate property photographed outdoors in bright natural daylight, clear sky, crisp detail.",
  interior: "A bright, clean real estate interior with natural daylight and a calm, airy atmosphere.",
};

export async function ilanVideosu(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const photos = (v.input as { photos?: IlanPhoto[] }).photos;
  if (!photos?.length) throw new Error("Fotoğraf yok");

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_VIDEO_ENDPOINT_ID;
  if (!apiKey || !endpoint) throw new Error("RUNPOD_API_KEY / RUNPOD_VIDEO_ENDPOINT_ID eksik");
  const profile = (process.env.RUNPOD_MODEL_PROFILE ?? "hunyuan15_480p") as ModelProfile;
  if (!(profile in MODEL_PROFILES)) throw new Error(`Bilinmeyen RUNPOD_MODEL_PROFILE: ${profile}`);
  const client = new RunpodClient(apiKey, endpoint);
  const provider = new RunpodVideoProvider(client, profile);

  // 1) Fotoğraflar: GPU worker'ı imzalı linkten kendisi indirir.
  await ctx.stage("photos");
  const urls = await Promise.all(photos.map((p) => ctx.r2.url(p.key, 3600)));

  // 2) Sahneler paralel
  await ctx.stage("clips", 0);
  let done = 0;
  let ext = 0;
  let int = 0;
  const clips = await Promise.all(
    photos.map(async (p, i) => {
      const camera = p.setting === "interior" ? INTERIOR[int++ % INTERIOR.length]! : EXTERIOR[ext++ % EXTERIOR.length]!;
      const scene: AiScene = {
        id: `sahne-${i + 1}`,
        type: "ai_photo_motion",
        durationSec: SCENE_SECONDS,
        photoUrl: urls[i]!,
        camera,
        setting: p.setting,
        prompt: SCENE_PROMPT[p.setting],
      };
      const out = await runpodJob(
        client,
        provider.buildInput({ projectId: v.id, scene, format: FORMAT, quality: "preview", seed: i + 1 }),
        `sahne ${i + 1}`,
        ctx.log,
      );
      const file = await saveOutput(out, "video", join(ctx.workDir, `sahne-${i + 1}.mp4`));
      await ctx.stage("clips", ++done / photos.length);
      return file;
    }),
  );

  // 3) Müzik (sahneler beklenirken değil, süre kesinleştikten sonra)
  const outro = [priceText(v.listing.priceTry), v.listing.officeName, v.listing.phone].filter(Boolean) as string[];
  const duration = clips.length * SCENE_SECONDS + (outro.length ? OUTRO_SECONDS : 0);
  await ctx.stage("music");
  const music = v.music ? await backgroundMusic(duration, ctx) : null;

  // 4) Kurgu: ölçekle, başlık yaz, kapanış kartı, uç uca ekle
  await ctx.stage("compose");
  const { width: W, height: H } = FORMAT_SPECS[FORMAT];
  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);
  const filters = clips.map((_, i) => {
    const title = photos[i]!.title;
    return (
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p` +
      (title ? `,${drawText(title, titleSize, "h*0.72", "white", 0.15)}` : "") +
      `[v${i}]`
    );
  });
  let count = clips.length;
  if (outro.length) {
    const lineH = Math.round(titleSize * 1.5);
    const top = Math.round(H / 2 - (outro.length * lineH) / 2);
    filters.push(
      `color=c=0x121a16:s=${W}x${H}:r=${OUT_FPS}:d=${OUTRO_SECONDS},format=yuv420p,` +
        outro.map((l, j) => drawText(l, j === 0 ? titleSize : subSize, String(top + j * lineH), j === 0 ? "0xFFC24D" : "white", j * 0.2)).join(",") +
        `[v${count}]`,
    );
    count += 1;
  }
  filters.push(`${Array.from({ length: count }, (_, i) => `[v${i}]`).join("")}concat=n=${count}:v=1:a=0[out]`);
  const silent = join(ctx.workDir, "ilan-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c]),
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", silent,
  ]);
  const final = await addMusic(silent, music, duration, join(ctx.workDir, "ilan.mp4"));
  return { videoPath: final, durationSec: duration, posterAt: 1.2, stats: { scenes: clips.length, profile } };
}
