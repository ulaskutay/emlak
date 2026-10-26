/**
 * Sunuculu ev turu (~40 sn): seçilen sanal sunucu (packages/shared/src/presenters.ts) her sahneye (oda ya da binanın
 * dışı) geniş açıyla yerleştirilir (Seedream 5.0 Pro), o kareden odada küçük adımlarla ilerleyip canlı bir Türkçe
 * anlatımla konuşan klip üretilir (Gemini Omni Flash 1.1, 360p, sesi modelin kendisi) ve 1080p 60 FPS'e büyütülür
 * (ByteDance, AIGC). Hepsi Higgsfield CLI ile, plan kredisinden. İstenirse odalar önce döşenir (Qwen, RunPod).
 * Metin panelden gelir (kullanıcı düzenler), yoksa tourScript. Klipler kendi sesleriyle dizilir; sahne başlıkları,
 * kelime kelime altyazı (zamanlar ElevenLabs Scribe'dan, altyazi.ts), emlakçı kartı ve konuşmada kısılan müzik eklenir.
 *
 * Maliyet (2026-10-26, plan kredisi), 10 sn'lik sahne: orta ~16,5 kredi (kare 2,5 + 360p klip 10 + büyütme 4),
 * yüksek ~36,5 (720p klip 30); 4 sahne orta ~66, yüksek ~146.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { HiggsfieldCli, RunpodClient } from "@arsa/providers";
import {
  FORMAT_SPECS,
  PRESENTERS,
  ROOM_LABELS,
  TOUR_QUALITY,
  presenterPlacePrompt,
  presenterVideoPrompt,
  stagingEditPrompt,
  speakable,
  tourScript,
  type ListingDetails,
  type PresenterId,
  type RoomType,
  type StagingStyle,
  type TourQuality,
  type TourScene,
} from "@arsa/shared";
import { agentCard } from "./agent-card.js";
import { clipWords, SUBTITLE_FONTS, writeSubtitles } from "./altyazi.js";
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
  /** Dikey (9:16) kırpılmış sahne fotoğrafı. */
  file: string;
  room: RoomType;
  title?: string;
  /** Sunucunun bu sahnede söyleyeceği metin (panelde düzenlenen); yoksa tourScript. */
  text?: string;
}

export interface TourOptions {
  presenter: PresenterId;
  /** Orta: Gemini 360p, yüksek: 720p; ikisi de 1080p 60 FPS'e büyütülür. */
  quality: TourQuality;
  details?: ListingDetails;
  priceTry?: number;
  style?: StagingStyle;
  music: boolean;
  agent: { name?: string; office?: string; phone?: string; photo?: string | null; logo?: string | null };
}

export async function sunucuEv(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const { photos, style, details, agent, presenter, quality } = v.input as {
    photos?: TourScene[];
    style?: StagingStyle;
    presenter?: PresenterId;
    quality?: TourQuality;
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
      return { file, room: p.room, title: p.title, text: p.text };
    }),
  );
  const fetchAsset = (key: string | undefined, name: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, name))).catch(() => null) : Promise.resolve(null);
  return presenterTour(ctx, rooms, {
    presenter: presenter ?? "defne",
    quality: quality ?? "orta",
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
  const script = tourScript(rooms.map((r) => r.room), o.details, [], o.priceTry);
  // Panelde düzenlenen metinde de rakam kalmasın ("20. kat" → "yirminci kat"): model rakamları bozuk okuyabiliyor.
  const lines = rooms.map((r, i) => speakable(r.text?.trim() || script[i]!));
  lines.forEach((l, i) => ctx.log(`metin ${i + 1}: ${l}`));

  // 1) İsteğe bağlı döşeme (Qwen, RunPod); binanın dışı döşenmez.
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
        if (r.room === "dis_cephe") return (await ctx.stage("staging", ++done / rooms.length), r.file);
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
      // Orta kalite 360p üretilip büyütülür (720p'nin üçte biri fiyatına, 2026-10-25 denemesi); yüksek kalite 720p'den.
      const raw = await hf.generate(
        VIDEO_MODEL,
        {
          params: { prompt: presenterVideoPrompt(r.room, lines[i]!, who), mode: "image-to-video", duration: clipSeconds(lines[i]!), resolution: TOUR_QUALITY[o.quality].resolution, aspect_ratio: "9:16" },
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
      // Altyazı için kelime zamanları (yazım senaryodan); alınamazsa sahne altyazısız.
      const words = await clipWords(file, lines[i]!, join(ctx.workDir, `altyazi-${i + 1}.mp3`)).catch((e) => {
        ctx.log(`! [sahne ${i + 1}] altyazı çıkarılamadı: ${String(e).slice(0, 160)}`);
        return [];
      });
      return { file, still: stillFile, words };
    }),
  );

  // 4) Kurgu: klipler kendi süreleriyle, başlıklar, altyazı, kapanış kartı; ses klibin kendi konuşması.
  await ctx.stage("compose");
  const durs = await Promise.all(clips.map((c) => probeDuration(c.file)));
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));
  // Altyazı: kliplerin kelime zamanları videonun eksenine kaydırılır.
  const words = clips.flatMap((c, i) => c.words.map((w) => ({ ...w, start: starts[i]! + w.start, end: starts[i]! + w.end })));
  const subs = words.length ? await writeSubtitles(words, join(ctx.workDir, "altyazi.ass"), W, H) : null;
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
  // Altyazı birleşik videoya bir kez yakılır (zamanlar videonun ekseninde). Yollarda boşluk/iki nokta olabilir: tırnaklı.
  const q = (f: string) => `'${f.replace(/'/g, "\\'")}'`;
  filters.push(
    `${Array.from({ length: n + 1 }, (_, i) => `[v${i}]`).join("")}concat=n=${n + 1}:v=1:a=0` +
      (subs ? `,ass=filename=${q(subs)}:fontsdir=${q(SUBTITLE_FONTS)}[out]` : "[out]"),
  );
  const silent = join(ctx.workDir, "sunucu-sessiz.mp4");
  await ffmpeg([
    ...clips.flatMap((c) => ["-i", c.file]),
    "-i", outroFile,
    "-filter_complex", filters.join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", silent,
  ]);
  const duration = await probeDuration(silent);

  // Klip sesleri: ses seviyesi eşitlenir (klipten klibe farklı), kendi sahnesinin başına konur.
  const cues = await Promise.all(
    clips.map(async (c, i) => {
      const file = join(ctx.workDir, `konusma-${i + 1}.m4a`);
      await ffmpeg(["-i", c.file, "-vn", "-af", "highpass=f=70,loudnorm=I=-16:TP=-2", "-ar", "44100", "-c:a", "aac", "-b:a", "192k", file]);
      return { at: starts[i]!, file };
    }),
  );
  const music = o.music ? await backgroundMusic(duration, ctx as JobContext) : null;
  const final = await mixAudio(silent, cues, music, duration, join(ctx.workDir, "sunucu-ev.mp4"));
  return {
    videoPath: final,
    durationSec: duration,
    posterAt: Math.min(1.5, durs[0]! / 2),
    stats: { presenter: o.presenter, quality: o.quality, rooms: rooms.length, style: o.style ?? null, narration: lines, clipSeconds: durs, subtitles: words.length },
  };
}
