/**
 * Boş evi döşe: her oda fotoğrafı Qwen-Image-Edit ile döşenir, Wan 2.2 ilk/son kare (boş → döşenmiş)
 * eşyaların yerleştiği sahneyi üretir; sahneler oda başlıkları ve kapanış kartıyla birleşir, ilan bilgisinden
 * kurulan Türkçe anlatım ve müzik eklenir. Sahne anlatımdan kısaysa döşenmiş son kare anlatım bitene kadar bekletilir.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RunpodClient } from "@arsa/providers";
import {
  FORMAT_SPECS,
  ROOM_LABELS,
  stagingEditPrompt,
  stagingNarration,
  stagingVideoPrompt,
  type ListingDetails,
  type RoomPhoto,
  type StagingStyle,
} from "@arsa/shared";
import {
  backgroundMusic,
  download,
  drawText,
  ffmpeg,
  mixAudio,
  priceText,
  probeDuration,
  runpodJob,
  saveOutput,
  speakLines,
  type JobContext,
  type JobResult,
} from "./common.js";

const OUT_FPS = 30;
const OUTRO_SECONDS = 3;
/** Döşenmiş son kare sahnenin sonunda bu kadar bekletilir (izleyici sonucu görsün). */
const HOLD_SECONDS = 1.2;
/** Anlatım sahne başından bu kadar sonra başlar, bittikten sonra bu kadar boşluk kalır. */
const VOICE_LEAD = 0.4;
const VOICE_TAIL = 0.6;
/** Qwen girdisi: dikey videoya kırpılmış kare; Wan aynı oranda (480x832) okur, iki kare hizalı kalır. */
const EDIT_W = 720;
const EDIT_H = 1280;

const dataUrl = async (path: string, mime: string) => `data:${mime};base64,${(await readFile(path)).toString("base64")}`;

export async function dosenmisEv(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const { photos, style, details, voice } = v.input as { photos?: RoomPhoto[]; style?: StagingStyle; details?: ListingDetails; voice?: boolean };
  if (!photos?.length || !style) throw new Error("Fotoğraf ya da döşeme tarzı yok");

  const apiKey = process.env.RUNPOD_API_KEY;
  const qwenId = process.env.RUNPOD_QWEN_ENDPOINT_ID;
  const wanId = process.env.RUNPOD_WAN_ENDPOINT_ID;
  if (!apiKey || !qwenId || !wanId) throw new Error("RUNPOD_QWEN_ENDPOINT_ID / RUNPOD_WAN_ENDPOINT_ID eksik");
  const qwen = new RunpodClient(apiKey, qwenId);
  const wan = new RunpodClient(apiKey, wanId);
  const { width: W, height: H } = FORMAT_SPECS.reels_9x16;

  // Seslendirme GPU işleriyle paralel; üretilemezse video anlatımsız çıkar.
  const narration = stagingNarration(photos.map((p) => p.room), details, v.listing.priceTry);
  const speech =
    voice === false
      ? Promise.resolve(null)
      : speakLines([...narration.rooms, narration.outro], v.voiceId, ctx).catch((e) => {
          ctx.log(`! seslendirme üretilemedi: ${String(e).slice(0, 200)}`);
          return null;
        });

  // 1) Boş oda fotoğrafları
  await ctx.stage("photos");
  const empty = await Promise.all(
    photos.map(async (p, i) => dataUrl(await download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `bos-${i + 1}.jpg`)), "image/jpeg")),
  );

  // 2) Döşeme: her oda paralel
  await ctx.stage("staging", 0);
  let done = 0;
  const furnished = await Promise.all(
    photos.map(async (p, i) => {
      const out = await runpodJob(
        qwen,
        { image_url: empty[i], width: EDIT_W, height: EDIT_H, seed: 11 + i, prompt: stagingEditPrompt(p.room, style) },
        `döşeme ${i + 1}`,
        ctx.log,
      );
      const file = await saveOutput(out, "image", join(ctx.workDir, `dosenmis-${i + 1}.png`));
      await ctx.stage("staging", ++done / photos.length);
      return dataUrl(file, "image/png");
    }),
  );

  // 3) Sahneler: boş → döşenmiş geçişi
  await ctx.stage("clips", 0);
  done = 0;
  const clips = await Promise.all(
    photos.map(async (p, i) => {
      const out = await runpodJob(
        wan,
        {
          image_url: empty[i],
          last_image_url: furnished[i],
          width: 480,
          height: 832,
          num_frames: 81, // Wan 16 fps → ~5 sn
          frame_rate: 16,
          num_steps: 4,
          output_width: W,
          output_height: H,
          output_key: `reels/${v.id}/oda-${i + 1}.mp4`,
          seed: 7 + i,
          prompt: stagingVideoPrompt(p.room),
        },
        `sahne ${i + 1}`,
        ctx.log,
      );
      const file = await saveOutput(out, "video", join(ctx.workDir, `oda-${i + 1}.mp4`));
      await ctx.stage("clips", ++done / photos.length);
      return file;
    }),
  );

  // 4) Kurgu: sahne süresi = max(klip + bekleme, anlatım). Oda başlığı üstte, "temsili" notu altta; kapanış kartı.
  await ctx.stage("compose");
  const voices = await speech;
  const clipDur = await Promise.all(clips.map((c) => probeDuration(c)));
  const need = (i: number) => (voices ? VOICE_LEAD + voices[i]!.duration + VOICE_TAIL : 0);
  const sceneDur = clips.map((_, i) => Math.max(clipDur[i]! + HOLD_SECONDS, need(i)));
  const outro = [priceText(v.listing.priceTry), v.listing.officeName, v.listing.phone].filter(Boolean) as string[];
  const outroDur = voices ? Math.max(OUTRO_SECONDS, need(clips.length)) : outro.length ? OUTRO_SECONDS : 0;

  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);
  const filters = clips.map(
    (_, i) =>
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
      `tpad=stop_mode=clone:stop_duration=${(sceneDur[i]! - clipDur[i]!).toFixed(3)},trim=duration=${sceneDur[i]!.toFixed(3)},` +
      `${drawText(photos[i]!.title || ROOM_LABELS[photos[i]!.room], titleSize, "h*0.10", "white", 0.3)},` +
      `${drawText("Temsili döşemedir", Math.round(subSize * 0.7), "h*0.93", "white@0.8")}[v${i}]`,
  );
  let count = clips.length;
  if (outroDur) {
    const lines = outro.length ? outro : ["Detaylar için arayın"];
    const lineH = Math.round(titleSize * 1.5);
    const top = Math.round(H / 2 - (lines.length * lineH) / 2);
    filters.push(
      `color=c=0x121a16:s=${W}x${H}:r=${OUT_FPS}:d=${outroDur.toFixed(3)},format=yuv420p,` +
        lines.map((l, j) => drawText(l, j === 0 ? titleSize : subSize, String(top + j * lineH), j === 0 ? "0xFFC24D" : "white", j * 0.2)).join(",") +
        `[v${count}]`,
    );
    count += 1;
  }
  filters.push(`${Array.from({ length: count }, (_, i) => `[v${i}]`).join("")}concat=n=${count}:v=1:a=0[out]`);
  const silent = join(ctx.workDir, "dosenmis-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c]),
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);
  const starts = [...sceneDur, 0].map((_, i) => sceneDur.slice(0, i).reduce((a, b) => a + b, 0));
  const cues = voices ? voices.map((s, i) => ({ at: starts[i]! + VOICE_LEAD, file: s.file })) : [];
  const music = v.music ? await backgroundMusic(duration, ctx) : null;
  const final = await mixAudio(silent, cues, music, duration, join(ctx.workDir, "dosenmis.mp4"));
  // Kapak: ilk odanın döşenmiş hali
  return {
    videoPath: final,
    durationSec: duration,
    posterAt: clipDur[0]! + 0.3,
    stats: { rooms: photos.length, style, narration: [...narration.rooms, narration.outro], voiced: !!voices },
  };
}
