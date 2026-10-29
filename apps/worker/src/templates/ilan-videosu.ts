/**
 * Fotoğraftan ilan videosu: her fotoğraf Higgsfield'da (Gemini Omni Flash, 1080p 60 FPS büyütmeyle) kamera hareketli
 * bir sahneye dönüşür, sahneler paralel üretilir, başlıklar ve kapanış kartıyla birleştirilip müzik eklenir.
 */
import { join } from "node:path";
import { HiggsfieldCli } from "@arsa/providers";
import { buildRealEstatePrompt, FORMAT_SPECS, type AiScene, type CameraMove, type IlanPhoto } from "@arsa/shared";
import { addMusic, backgroundMusic, CLIP_FPS, download, drawText, ffmpeg, geminiClip, priceText, type JobContext, type JobResult } from "./common.js";

const FORMAT = "reels_9x16" as const;
/** Gemini 5 sn üretir; sahnenin en akıcı ilk 4 sn'si kullanılır. */
const CLIP_SECONDS = 5;
const SCENE_SECONDS = 4;
const OUTRO_SECONDS = 3;
const OUT_FPS = CLIP_FPS;

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

  const hf = new HiggsfieldCli();

  // 1) Fotoğraflar dikey kadraja (ortadan) kırpılır; model kareyi olduğu gibi canlandırır.
  await ctx.stage("photos");
  const frames = await Promise.all(
    photos.map(async (p, i) => {
      const raw = await download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `ham-${i + 1}.jpg`));
      const out = join(ctx.workDir, `kare-${i + 1}.jpg`);
      await ffmpeg(["-i", raw, "-vf", "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=720:1280", "-q:v", "2", out]);
      return out;
    }),
  );

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
        photoUrl: "",
        camera,
        setting: p.setting,
        prompt: SCENE_PROMPT[p.setting],
      };
      const file = await geminiClip(hf, {
        prompt: `${buildRealEstatePrompt(scene).prompt} No people. Audio: no speech, only quiet ambience.`,
        start: frames[i]!,
        seconds: CLIP_SECONDS,
        out: join(ctx.workDir, `sahne-${i + 1}.mp4`),
        label: `sahne ${i + 1}`,
        log: ctx.log,
      });
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
      `[${i}:v]trim=duration=${SCENE_SECONDS},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p` +
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
  return { videoPath: final, durationSec: duration, posterAt: 1.2, stats: { scenes: clips.length, model: "gemini_omni_flash_1_1" } };
}
