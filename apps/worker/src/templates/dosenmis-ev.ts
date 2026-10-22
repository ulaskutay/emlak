/**
 * Boş evi döşe: her oda fotoğrafı Qwen-Image-Edit ile döşenir, Wan 2.2 ilk/son kare (boş → döşenmiş)
 * eşyaların yerleştiği sahneyi üretir; sahneler oda başlıkları ve emlakçı kartıyla birleşir, ilan bilgisinden
 * kurulan Türkçe anlatım ve müzik eklenir. Video oda sayısından bağımsız TOTAL_SECONDS sürer: odalar süreyi
 * eşit paylaşır, geçiş sahnesi gerekirse yavaşlatılır/hızlandırılır, sonunda döşenmiş kare kısa bekletilir.
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
const TOTAL_SECONDS = 21;
const OUTRO_SECONDS = 3.5;
/** Döşenmiş son kare her sahnenin sonunda bu kadar bekletilir (izleyici sonucu görsün). */
const HOLD_SECONDS = 0.7;
/** Geçiş sahnesinin hız sınırları (Wan klibi ~5 sn; 2 odada yavaşlar, 4 odada hızlanır). */
const MIN_SPEED = 0.6;
const MAX_SPEED = 1.5;
/** Anlatım: ilk cümle bu saniyede başlar, cümleler arası boşluk; sığmazsa ses en fazla bu kadar hızlandırılır. */
const VOICE_LEAD = 0.4;
const VOICE_GAP = 0.25;
const MAX_VOICE_TEMPO = 1.15;
/** Qwen girdisi: dikey videoya kırpılmış kare; Wan aynı oranda (480x832) okur, iki kare hizalı kalır. */
const EDIT_W = 720;
const EDIT_H = 1280;

const dataUrl = async (path: string, mime: string) => `data:${mime};base64,${(await readFile(path)).toString("base64")}`;

export async function dosenmisEv(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const { photos, style, details, agent, voice } = v.input as {
    photos?: RoomPhoto[];
    style?: StagingStyle;
    details?: ListingDetails;
    agent?: { name?: string; photoKey?: string; logoKey?: string };
    voice?: boolean;
  };
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
      : speakLines([...narration.rooms, narration.outro].filter(Boolean), v.voiceId, ctx).catch((e) => {
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

  // 4) Kurgu
  await ctx.stage("compose");
  const voices = await speech;
  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);
  const scene = (TOTAL_SECONDS - OUTRO_SECONDS) / clips.length;
  const clipDur = await Promise.all(clips.map((c) => probeDuration(c)));
  // Klibin oynama süresi: sahneden bekleme payı düşülür, hız sınırları içinde kalır.
  const play = clipDur.map((d) => Math.min(d / MIN_SPEED, Math.max(d / MAX_SPEED, scene - HOLD_SECONDS)));
  const filters = clips.map(
    (_, i) =>
      `[${i}:v]setpts=PTS*${(play[i]! / clipDur[i]!).toFixed(4)},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
      `tpad=stop_mode=clone:stop_duration=${scene.toFixed(3)},trim=duration=${scene.toFixed(3)},setpts=PTS-STARTPTS,` +
      `${drawText(photos[i]!.title || ROOM_LABELS[photos[i]!.room], titleSize, "h*0.10", "white", 0.3)},` +
      `${drawText("Temsili döşemedir", Math.round(subSize * 0.7), "h*0.93", "white@0.8")}[v${i}]`,
  );
  const outroFile = await agentCard(ctx, {
    price: priceText(v.listing.priceTry),
    rent: /kiralık/i.test(details?.kind ?? ""),
    name: agent?.name,
    office: v.listing.officeName,
    phone: v.listing.phone,
    photoKey: agent?.photoKey,
    logoKey: agent?.logoKey,
  });
  const n = clips.length;
  filters.push(`[${n}:v]fps=${OUT_FPS},format=yuv420p,setsar=1[v${n}]`);
  filters.push(`${Array.from({ length: n + 1 }, (_, i) => `[v${i}]`).join("")}concat=n=${n + 1}:v=1:a=0[out]`);
  const silent = join(ctx.workDir, "dosenmis-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c]),
    "-i", outroFile,
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-t", String(TOTAL_SECONDS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);

  // Anlatım yerleşimi: her cümle kendi sahnesinin başında, önceki bitmeden değil; sona sığmazsa ses hızlandırılır.
  const all = [...narration.rooms, narration.outro];
  const starts = [...clips.map((_, i) => i * scene), TOTAL_SECONDS - OUTRO_SECONDS];
  let cues: { at: number; file: string }[] = [];
  if (voices) {
    const spoken = all.map((t, i) => ({ t, at: starts[i]! })).filter((x) => x.t);
    const place = (tempo: number) => {
      let end = 0;
      const out = spoken.map((x, k) => {
        const at = Math.max(x.at + VOICE_LEAD, end + (k ? VOICE_GAP : 0));
        end = at + voices[k]!.duration / tempo;
        return { at, file: voices[k]!.file };
      });
      return { out, end };
    };
    let tempo = 1;
    let placed = place(tempo);
    if (placed.end > duration - 0.3) {
      tempo = Math.min(MAX_VOICE_TEMPO, voices.reduce((a, s) => a + s.duration, 0) / (duration - 0.3 - VOICE_LEAD - VOICE_GAP * (voices.length - 1)));
      placed = place(Math.max(1, tempo));
      ctx.log(`anlatım ${tempo.toFixed(2)}x hızlandırıldı`);
    }
    cues = tempo > 1 ? await Promise.all(placed.out.map(async (c, k) => ({ at: c.at, file: await speedUp(c.file, tempo, join(ctx.workDir, `ses-${k}.m4a`)) }))) : placed.out;
  }
  const music = v.music ? await backgroundMusic(duration, ctx) : null;
  const final = await mixAudio(silent, cues, music, duration, join(ctx.workDir, "dosenmis.mp4"));
  return {
    videoPath: final,
    durationSec: duration,
    posterAt: play[0]! + 0.2,
    stats: { rooms: photos.length, style, narration: all, voiced: !!voices },
  };
}

const speedUp = async (file: string, tempo: number, out: string) => (await ffmpeg(["-i", file, "-af", `atempo=${tempo.toFixed(3)}`, "-c:a", "aac", out]), out);

/**
 * Kapanış kartı (OUTRO_SECONDS): fiyat, emlakçının yuvarlak fotoğrafı, adı, ofisi, telefonu ve ofis logosu.
 * Olmayan parça atlanır; hiçbiri yoksa yalnız çağrı yazar.
 */
async function agentCard(
  ctx: JobContext,
  a: { price?: string; rent: boolean; name?: string; office?: string; phone?: string; photoKey?: string; logoKey?: string },
) {
  const { width: W, height: H } = FORMAT_SPECS.reels_9x16;
  const big = Math.round(W * 0.085);
  const mid = Math.round(W * 0.05);
  const small = Math.round(W * 0.036);
  const inputs = ["-f", "lavfi", "-i", `color=c=0x121a16:s=${W}x${H}:r=${OUT_FPS}:d=${OUTRO_SECONDS}`];
  const f: string[] = [];
  let last = "[0:v]";
  let k = 1;
  const D = 380; // fotoğraf çapı
  const photo = a.photoKey ? await download(await ctx.r2.url(a.photoKey, 600), join(ctx.workDir, "emlakci.jpg")).catch(() => null) : null;
  const logo = a.logoKey ? await download(await ctx.r2.url(a.logoKey, 600), join(ctx.workDir, "logo.png")).catch(() => null) : null;
  if (photo) {
    inputs.push("-i", photo);
    f.push(
      `[${k}:v]scale=${D}:${D}:force_original_aspect_ratio=increase,crop=${D}:${D},format=rgba,` +
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${D / 2},Y-${D / 2}),${D / 2 - 2}),255,0)'[ph]`,
      `${last}[ph]overlay=(W-w)/2:${Math.round(H * 0.25)}[b${k}]`,
    );
    last = `[b${k}]`;
    k++;
  }
  if (logo) {
    inputs.push("-i", logo);
    // Logo en fazla 480x210, beyaz zeminli kutuda (koyu logolar koyu arka planda kaybolmasın).
    f.push(
      `[${k}:v]scale=w='min(480,iw*210/ih)':h=-1,format=rgba,pad=iw+40:ih+30:20:15:color=white@1[lg]`,
      `${last}[lg]overlay=(W-w)/2:${Math.round(H * 0.74)}[b${k}]`,
    );
    last = `[b${k}]`;
    k++;
  }
  const texts: string[] = [];
  const y = (r: number) => String(Math.round(H * r));
  if (a.price) {
    texts.push(drawText(a.price, big, y(0.1), "0xFFC24D", 0));
    if (a.rent) texts.push(drawText("aylık kira", small, y(0.1 + 0.055), "white@0.85", 0.1));
  }
  const top = photo ? 0.25 + D / H + 0.025 : 0.3;
  if (a.name) texts.push(drawText(a.name, mid, y(top), "white", 0.2));
  if (a.office) texts.push(drawText(a.office, small, y(top + 0.04), "white@0.8", 0.25));
  if (a.phone) texts.push(drawText(a.phone, big, y(top + 0.09), "white", 0.3));
  if (!texts.length) texts.push(drawText("Detaylar için arayın", big, y(0.45), "white", 0));
  f.push(`${last}${texts.join(",")},format=yuv420p[out]`);
  const out = join(ctx.workDir, "kapanis.mp4");
  await ffmpeg([...inputs, "-filter_complex", f.join(";"), "-map", "[out]", "-t", String(OUTRO_SECONDS), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out]);
  return out;
}
