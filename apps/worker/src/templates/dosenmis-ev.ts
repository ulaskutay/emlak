/**
 * Boş evi döşe: her oda fotoğrafı Higgsfield (Nano Banana 2.1) ile döşenir, Wan 2.2 ilk/son kare (boş → döşenmiş)
 * eşyaların yerleştiği sahneyi üretir; sahneler oda başlıkları ve emlakçı kartıyla birleşir, ilan bilgisinden
 * kurulan Türkçe anlatım ve müzik eklenir. Video oda sayısından bağımsız TOTAL_SECONDS sürer: odalar süreyi
 * eşit paylaşır, geçiş sahnesi gerekirse yavaşlatılır/hızlandırılır, sonunda döşenmiş kare kısa bekletilir.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HiggsfieldCli, RunpodClient } from "@arsa/providers";
import {
  FORMAT_SPECS,
  ROOM_LABELS,
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
  furnishRoom,
  mixAudio,
  priceText,
  probeDuration,
  runpodJob,
  saveOutput,
  speakLines,
  type JobContext,
  type JobResult,
} from "./common.js";
import { agentCard } from "./agent-card.js";

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
/** Döşeme girdisi/çıktısı: dikey videoya kırpılmış kare; Wan aynı oranda (480x832) okur, iki kare hizalı kalır. */
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
  const wanId = process.env.RUNPOD_WAN_ENDPOINT_ID;
  if (!apiKey || !wanId) throw new Error("RUNPOD_WAN_ENDPOINT_ID eksik");
  const hf = new HiggsfieldCli();
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
  // Dikey kadraj burada kırpılır (kullanıcının seçtiği yatay konumla); GPU tarafı yalnız ölçekler.
  const emptyFiles = await Promise.all(
    photos.map(async (p, i) => {
      const raw = await download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `ham-${i + 1}.jpg`));
      const crop = join(ctx.workDir, `bos-${i + 1}.jpg`);
      const cw = "min(iw\\,ih*9/16)";
      const ch = "min(ih\\,iw*16/9)";
      await ffmpeg(["-i", raw, "-vf", `crop=${cw}:${ch}:(iw-${cw})*${p.focusX ?? 0.5}:(ih-${ch})/2`, "-q:v", "2", crop]);
      return crop;
    }),
  );
  const empty = await Promise.all(emptyFiles.map((f) => dataUrl(f, "image/jpeg")));

  // 2) Döşeme: her oda paralel
  await ctx.stage("staging", 0);
  let done = 0;
  const furnished = await Promise.all(
    photos.map(async (p, i) => {
      const file = await furnishRoom(hf, emptyFiles[i]!, p.room, style, join(ctx.workDir, `dosenmis-${i + 1}.png`), {
        seed: 11 + i,
        label: `döşeme ${i + 1}`,
        log: ctx.log,
        width: EDIT_W,
        height: EDIT_H,
      });
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
  // Kapanış kartı: arka planı son odanın döşenmiş karesi (kesme yerine aynı odadan bulanık geçiş).
  const lastFrame = join(ctx.workDir, "son-kare.png");
  await ffmpeg(["-sseof", "-0.2", "-i", clips[clips.length - 1]!, "-frames:v", "1", lastFrame]);
  const fetchAsset = (key: string | undefined, name: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, name))).catch(() => null) : Promise.resolve(null);
  const outroFile = await agentCard(ctx.workDir, {
    price: priceText(v.listing.priceTry),
    rent: /kiralık/i.test(details?.kind ?? ""),
    name: agent?.name,
    office: v.listing.officeName,
    phone: v.listing.phone,
    photo: await fetchAsset(agent?.photoKey, "emlakci.jpg"),
    logo: await fetchAsset(agent?.logoKey, "logo.png"),
    background: lastFrame,
    seconds: OUTRO_SECONDS,
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
    // İleri: her cümle sahnesinin başında ya da öncekinin ardından. Geri: son cümle videonun sonuna sığacak
    // kadar öne çekilir, öncekiler de ona göre. İlk cümle baştaki payın önüne düşerse bu hızda sığmıyor demektir.
    const place = (tempo: number) => {
      const len = voices.map((s) => s.duration / tempo);
      const at: number[] = [];
      spoken.forEach((x, k) => at.push(Math.max(x.at + VOICE_LEAD, k ? at[k - 1]! + len[k - 1]! + VOICE_GAP : 0)));
      let limit = duration - 0.3;
      for (let k = at.length - 1; k >= 0; k--) {
        at[k] = Math.min(at[k]!, limit - len[k]!);
        limit = at[k]! - VOICE_GAP;
      }
      return { out: at.map((t, k) => ({ at: Math.max(0, t), file: voices[k]!.file })), fits: at[0]! >= VOICE_LEAD - 0.05 };
    };
    let tempo = 1;
    let placed = place(tempo);
    while (!placed.fits && tempo < MAX_VOICE_TEMPO) {
      tempo = Math.min(MAX_VOICE_TEMPO, tempo + 0.05);
      placed = place(tempo);
    }
    if (tempo > 1) ctx.log(`anlatım ${tempo.toFixed(2)}x hızlandırıldı${placed.fits ? "" : " (yine de sığmadı, sonu kesilebilir)"}`);
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
