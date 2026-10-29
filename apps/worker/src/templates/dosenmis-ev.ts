/**
 * Boş evi döşe: her oda fotoğrafı Higgsfield (Nano Banana 2.1) ile döşenir, Gemini Omni Flash ilk/son kare
 * (boş → döşenmiş) eşyaların yerleştiği sahneyi üretir, ByteDance büyütücü 1080p'ye çıkarır; sahneler oda başlıkları ve emlakçı kartıyla birleşir, ilan bilgisinden
 * kurulan Türkçe anlatım ve müzik eklenir. Video en az TOTAL_SECONDS sürer: odalar süreyi eşit paylaşır, odanın
 * cümlesi uzunsa o sahne uzar (anlatım hızlandırılmaz, kesilmez); geçiş sahnesi gerekirse yavaşlatılır/hızlandırılır,
 * sonunda döşenmiş kare bekletilir.
 */
import { join } from "node:path";
import { HiggsfieldCli } from "@arsa/providers";
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
  speakLines,
  type JobContext,
  type JobResult,
} from "./common.js";
import { agentCard } from "./agent-card.js";

/** Büyütücü 60 FPS verir (AIGC ön ayarı); kurgu da 60 FPS. */
const OUT_FPS = 60;
const TOTAL_SECONDS = 21;
const OUTRO_SECONDS = 3.5;
/** Döşenmiş son kare her sahnenin sonunda bu kadar bekletilir (izleyici sonucu görsün). */
const HOLD_SECONDS = 0.7;
/** Geçiş sahnesinin hız sınırları (klip ~5 sn; 2 odada yavaşlar, 4 odada hızlanır). */
const MIN_SPEED = 0.6;
const MAX_SPEED = 1.5;
/** Anlatım: cümle sahnesinin başından bu kadar sonra başlar, bitince sahne en az bu kadar daha sürer. */
const VOICE_LEAD = 0.4;
const VOICE_TAIL = 0.4;
/** Kapanışta fiyat cümlesinden sonra kartın kalacağı süre. */
const OUTRO_TAIL = 1;
/** Boş ve döşenmiş kare aynı boyutta: geçiş klibinin ilk/son kareleri hizalı kalır. */
const EDIT_W = 720;
const EDIT_H = 1280;
/** Geçiş klibi: Gemini 360p (720p'nin üçte biri fiyatına, içerik aynı; 2026-10-29), büyütücü 1080p'ye çıkarır. */
const CLIP_MODEL = "gemini_omni_flash_1_1";
const CLIP_SECONDS = 5;
const UPSCALE_MODEL = "bytedance_video_upscale";

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

  const hf = new HiggsfieldCli();
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
  const empty = await Promise.all(
    photos.map(async (p, i) => {
      const raw = await download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `ham-${i + 1}.jpg`));
      const crop = join(ctx.workDir, `bos-${i + 1}.jpg`);
      const cw = "min(iw\\,ih*9/16)";
      const ch = "min(ih\\,iw*16/9)";
      await ffmpeg(["-i", raw, "-vf", `crop=${cw}:${ch}:(iw-${cw})*${p.focusX ?? 0.5}:(ih-${ch})/2,scale=${EDIT_W}:${EDIT_H}`, "-q:v", "2", crop]);
      return crop;
    }),
  );

  // 2) Döşeme: her oda paralel
  await ctx.stage("staging", 0);
  let done = 0;
  const furnished = await Promise.all(
    photos.map(async (p, i) => {
      const file = await furnishRoom(hf, empty[i]!, p.room, style, join(ctx.workDir, `dosenmis-${i + 1}.png`), {
        seed: 11 + i,
        label: `döşeme ${i + 1}`,
        log: ctx.log,
        width: EDIT_W,
        height: EDIT_H,
      });
      await ctx.stage("staging", ++done / photos.length);
      return file;
    }),
  );

  // 3) Sahneler: boş → döşenmiş geçişi
  await ctx.stage("clips", 0);
  done = 0;
  const clips = await Promise.all(
    photos.map(async (p, i) => {
      const raw = await hf.generate(
        CLIP_MODEL,
        {
          params: { prompt: stagingVideoPrompt(p.room), mode: "image-to-video", duration: CLIP_SECONDS, resolution: "360p", aspect_ratio: "9:16" },
          media: [["start-image", empty[i]!], ["end-image", furnished[i]!]],
        },
        { label: `sahne ${i + 1}`, log: ctx.log },
      );
      const clip = await hf.generate(
        UPSCALE_MODEL,
        { params: { model_version: "standard", resolution: "1080p", fps: OUT_FPS, preset: "aigc" }, media: [["video-references", raw.id]] },
        { label: `büyütme ${i + 1}`, log: ctx.log },
      );
      const file = await download(clip.url, join(ctx.workDir, `oda-${i + 1}.mp4`));
      await ctx.stage("clips", ++done / photos.length);
      return file;
    }),
  );

  // 4) Kurgu: her oda en az eşit payını alır; cümlesi uzunsa sahne uzar, ses kendi hızında kalır.
  await ctx.stage("compose");
  const voices = await speech;
  const all = [...narration.rooms, narration.outro];
  const spokenAt = all.flatMap((t, i) => (t ? [i] : []));
  const voiceDur = all.map((_, i) => (voices ? (voices[spokenAt.indexOf(i)]?.duration ?? 0) : 0));
  const n = clips.length;
  const base = (TOTAL_SECONDS - OUTRO_SECONDS) / n;
  const scenes = clips.map((_, i) => Math.max(base, voiceDur[i]! ? VOICE_LEAD + voiceDur[i]! + VOICE_TAIL : 0));
  const outroSec = Math.max(OUTRO_SECONDS, voiceDur[n]! ? VOICE_LEAD + voiceDur[n]! + OUTRO_TAIL : 0);
  const starts = [...scenes.map((_, i) => scenes.slice(0, i).reduce((a, b) => a + b, 0)), scenes.reduce((a, b) => a + b, 0)];
  const total = starts[n]! + outroSec;
  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);
  const clipDur = await Promise.all(clips.map((c) => probeDuration(c)));
  // Klibin oynama süresi: sahneden bekleme payı düşülür, hız sınırları içinde kalır.
  const play = clipDur.map((d, i) => Math.min(d / MIN_SPEED, Math.max(d / MAX_SPEED, scenes[i]! - HOLD_SECONDS)));
  const filters = clips.map(
    (_, i) =>
      `[${i}:v]setpts=PTS*${(play[i]! / clipDur[i]!).toFixed(4)},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
      `tpad=stop_mode=clone:stop_duration=${scenes[i]!.toFixed(3)},trim=duration=${scenes[i]!.toFixed(3)},setpts=PTS-STARTPTS,` +
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
    seconds: outroSec,
  });
  filters.push(`[${n}:v]fps=${OUT_FPS},format=yuv420p,setsar=1[v${n}]`);
  filters.push(`${Array.from({ length: n + 1 }, (_, i) => `[v${i}]`).join("")}concat=n=${n + 1}:v=1:a=0[out]`);
  const silent = join(ctx.workDir, "dosenmis-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c]),
    "-i", outroFile,
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-t", total.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);

  // Her cümle kendi sahnesinin başında; sahneler cümleye göre uzadığı için üst üste binmez.
  const cues = voices ? spokenAt.map((i, k) => ({ at: starts[i]! + VOICE_LEAD, file: voices[k]!.file })) : [];
  const music = v.music ? await backgroundMusic(duration, ctx) : null;
  const final = await mixAudio(silent, cues, music, duration, join(ctx.workDir, "dosenmis.mp4"));
  return {
    videoPath: final,
    durationSec: duration,
    posterAt: play[0]! + 0.2,
    stats: { rooms: photos.length, style, narration: all, voiced: !!voices },
  };
}
