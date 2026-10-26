/**
 * Sunuculu ev turu: seçilen sanal sunucu (packages/shared/src/presenters.ts) her oda fotoğrafına yerleştirilir
 * (Seedream 5.0 Pro), o kareden kameraya Türkçe konuşan klip üretilir (Gemini Omni Flash 1.1, 360p, sesi modelin
 * kendisi) ve 1080p 60 FPS'e büyütülür (ByteDance, AIGC ön ayarı). Hepsi Higgsfield CLI ile, plan kredisinden.
 * İstenirse boş odalar önce döşenir (Qwen, RunPod). Klipler kendi sesleriyle art arda dizilir, oda başlıkları,
 * emlakçı kartı ve konuşma sırasında kısılan müzik eklenir.
 *
 * Maliyet (2026-10-25, plan kredisi): 10 sn'lik oda ~16,5 kredi (kare 2,5 + klip 10 + büyütme 4).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { HiggsfieldCli, RunpodClient } from "@arsa/providers";
import {
  FORMAT_SPECS,
  PRESENTERS,
  ROOM_LABELS,
  presenterNarration,
  presenterPlacePrompt,
  presenterVideoPrompt,
  stagingEditPrompt,
  type ListingDetails,
  type PresenterId,
  type RoomPhoto,
  type RoomType,
  type StagingStyle,
} from "@arsa/shared";
import { agentCard } from "./agent-card.js";
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
  type JobContext,
  type JobResult,
} from "./common.js";

/** Büyütme 60 FPS veriyor; kurgu da 60 FPS (akıcı hareket, 2026-10-25'te beğenildi). */
const OUT_FPS = 60;
const OUTRO_SECONDS = 3.5;
/** Sunucunun referans görselleri: ana (boy) ve yüz yakın. */
const presenterRefs = (id: PresenterId) =>
  [`${id}.jpg`, `${id}-2.jpg`].map((f) => fileURLToPath(new URL(`../../media/sunucular/${f}`, import.meta.url)));
const IMAGE_MODEL = "seedream_v5_pro";
const VIDEO_MODEL = "gemini_omni_flash_1_1";
const UPSCALE_MODEL = "bytedance_video_upscale";
/** Klip süresi cümleye göre: ~2,2 kelime/sn + baş ve sonda pay; Gemini Omni'de en fazla 10 sn. */
const clipSeconds = (line: string) => Math.min(10, Math.max(5, Math.ceil(line.split(/\s+/).filter(Boolean).length / 2.2 + 2)));

export interface TourRoom {
  /** Dikey (9:16) kırpılmış oda fotoğrafı. */
  file: string;
  room: RoomType;
  title?: string;
}

export interface TourOptions {
  presenter: PresenterId;
  details?: ListingDetails;
  priceTry?: number;
  style?: StagingStyle;
  music: boolean;
  agent: { name?: string; office?: string; phone?: string; photo?: string | null; logo?: string | null };
}

export async function sunucuEv(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const { photos, style, details, agent, presenter } = v.input as {
    photos?: RoomPhoto[];
    style?: StagingStyle;
    presenter?: PresenterId;
    details?: ListingDetails;
    agent?: { name?: string; photoKey?: string; logoKey?: string };
  };
  if (!photos?.length) throw new Error("Fotoğraf yok");

  await ctx.stage("photos");
  // Dikey kadraj burada kırpılır (kullanıcının seçtiği yatay konumla).
  const rooms = await Promise.all(
    photos.map(async (p, i): Promise<TourRoom> => {
      const raw = await download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `ham-${i + 1}.jpg`));
      const file = join(ctx.workDir, `oda-${i + 1}.jpg`);
      const cw = "min(iw\\,ih*9/16)";
      const ch = "min(ih\\,iw*16/9)";
      await ffmpeg(["-i", raw, "-vf", `crop=${cw}:${ch}:(iw-${cw})*${p.focusX ?? 0.5}:(ih-${ch})/2`, "-q:v", "2", file]);
      return { file, room: p.room, title: p.title };
    }),
  );
  const fetchAsset = (key: string | undefined, name: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, name))).catch(() => null) : Promise.resolve(null);
  return presenterTour(ctx, rooms, {
    presenter: presenter ?? "defne",
    details,
    priceTry: v.listing.priceTry,
    style,
    music: v.music,
    agent: {
      name: agent?.name,
      office: v.listing.officeName,
      phone: v.listing.phone,
      photo: await fetchAsset(agent?.photoKey, "emlakci.jpg"),
      logo: await fetchAsset(agent?.logoKey, "logo.png"),
    },
  });
}

/** Üretim hattının kendisi (yerel dosyalarla): worker şablonu ve deneme betiği kullanır. */
export async function presenterTour(ctx: Pick<JobContext, "workDir" | "cacheDir" | "log" | "stage">, rooms: TourRoom[], o: TourOptions): Promise<JobResult> {
  const hf = new HiggsfieldCli();
  const who = PRESENTERS[o.presenter];
  const refs = presenterRefs(o.presenter);
  const { width: W, height: H } = FORMAT_SPECS.reels_9x16;
  const lines = presenterNarration(rooms.map((r) => r.room), o.details, o.priceTry);
  lines.forEach((l, i) => ctx.log(`metin ${i + 1}: ${l}`));

  // 1) İsteğe bağlı döşeme (Qwen, RunPod)
  let scenes = rooms.map((r) => r.file);
  if (o.style) {
    const apiKey = process.env.RUNPOD_API_KEY;
    const qwenId = process.env.RUNPOD_QWEN_ENDPOINT_ID;
    if (!apiKey || !qwenId) throw new Error("RUNPOD_QWEN_ENDPOINT_ID eksik");
    const qwen = new RunpodClient(apiKey, qwenId);
    await ctx.stage("staging", 0);
    let done = 0;
    scenes = await Promise.all(
      rooms.map(async (r, i) => {
        const image_url = `data:image/jpeg;base64,${(await readFile(r.file)).toString("base64")}`;
        const out = await runpodJob(qwen, { image_url, width: 720, height: 1280, seed: 11 + i, prompt: stagingEditPrompt(r.room, o.style!) }, `döşeme ${i + 1}`, ctx.log);
        const file = await saveOutput(out, "image", join(ctx.workDir, `dosenmis-${i + 1}.png`));
        await ctx.stage("staging", ++done / rooms.length);
        return file;
      }),
    );
  }

  // 2) Sunucu odaya yerleşir, 3) kameraya konuşur. Odalar paralel; Higgsfield sırası istemcide.
  await ctx.stage("presenter", 0);
  let placed = 0;
  let filmed = 0;
  const clips = await Promise.all(
    rooms.map(async (r, i) => {
      const still = await hf.generate(
        IMAGE_MODEL,
        {
          params: { prompt: presenterPlacePrompt(r.room, who), aspect_ratio: "9:16", resolution: "2k" },
          media: [["image", scenes[i]!], ...refs.map((f): [string, string] => ["image", f])],
        },
        { label: `sunucu ${i + 1}`, log: ctx.log },
      );
      const stillFile = await download(still.url, join(ctx.workDir, `sunucu-${i + 1}.jpg`));
      await ctx.stage("presenter", ++placed / rooms.length);
      // 360p üretilip büyütülür: 720p'nin üçte biri fiyatına, büyütmeyle daha net (2026-10-25 denemesi).
      const raw = await hf.generate(
        VIDEO_MODEL,
        {
          params: { prompt: presenterVideoPrompt(r.room, lines[i]!, who), mode: "image-to-video", duration: clipSeconds(lines[i]!), resolution: "360p", aspect_ratio: "9:16" },
          media: [["start-image", still.id]],
        },
        { label: `sahne ${i + 1}`, log: ctx.log },
      );
      const clip = await hf.generate(
        UPSCALE_MODEL,
        { params: { model_version: "standard", resolution: "1080p", fps: 60, preset: "aigc" }, media: [["video-references", raw.id]] },
        { label: `büyütme ${i + 1}`, log: ctx.log },
      );
      const file = await download(clip.url, join(ctx.workDir, `sahne-${i + 1}.mp4`));
      await ctx.stage("clips", ++filmed / rooms.length);
      return { file, still: stillFile };
    }),
  );

  // 4) Kurgu: klipler kendi süreleriyle, başlıklar, kapanış kartı; ses klibin kendi konuşması.
  await ctx.stage("compose");
  const durs = await Promise.all(clips.map((c) => probeDuration(c.file)));
  const titleSize = Math.round(W * 0.075);
  const noteSize = Math.round(W * 0.03);
  const filters = clips.map(
    (_, i) =>
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
      `trim=duration=${durs[i]!.toFixed(3)},setpts=PTS-STARTPTS,` +
      `${drawText(rooms[i]!.title || ROOM_LABELS[rooms[i]!.room], titleSize, "h*0.08", "white", 0.3)},` +
      `${drawText(o.style ? "Sunucu ve döşeme temsilidir" : "Sanal sunucu", noteSize, "h*0.94", "white@0.75")}[v${i}]`,
  );
  const lastFrame = join(ctx.workDir, "son-kare.png");
  await ffmpeg(["-sseof", "-0.2", "-i", clips[clips.length - 1]!.file, "-frames:v", "1", lastFrame]);
  const outroFile = await agentCard(ctx.workDir, {
    price: priceText(o.priceTry),
    rent: /kiralık/i.test(o.details?.kind ?? ""),
    name: o.agent.name,
    office: o.agent.office,
    phone: o.agent.phone,
    photo: o.agent.photo,
    logo: o.agent.logo,
    background: lastFrame,
    seconds: OUTRO_SECONDS,
  });
  const n = clips.length;
  filters.push(`[${n}:v]fps=${OUT_FPS},format=yuv420p,setsar=1[v${n}]`);
  filters.push(`${Array.from({ length: n + 1 }, (_, i) => `[v${i}]`).join("")}concat=n=${n + 1}:v=1:a=0[out]`);
  const silent = join(ctx.workDir, "sunucu-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c.file]),
    "-i", outroFile,
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);

  // Klip sesleri: ses seviyesi eşitlenir (Kling tepe ~-0,7 dB, klipten klibe farklı), kendi sahnesinin başına konur.
  let at = 0;
  const cues = await Promise.all(
    clips.map(async (c, i) => {
      const file = join(ctx.workDir, `konusma-${i + 1}.m4a`);
      await ffmpeg(["-i", c.file, "-vn", "-af", "highpass=f=70,loudnorm=I=-16:TP=-2", "-ar", "44100", "-c:a", "aac", "-b:a", "192k", file]);
      const cue = { at, file };
      at += durs[i]!;
      return cue;
    }),
  );
  const music = o.music ? await backgroundMusic(duration, ctx as JobContext) : null;
  const final = await mixAudio(silent, cues, music, duration, join(ctx.workDir, "sunucu-ev.mp4"));
  return {
    videoPath: final,
    durationSec: duration,
    posterAt: Math.min(1.5, durs[0]! / 2),
    stats: { presenter: o.presenter, rooms: rooms.length, style: o.style ?? null, narration: lines, clipSeconds: durs },
  };
}
