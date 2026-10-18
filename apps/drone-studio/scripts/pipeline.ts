/**
 * Arsa Reels üretim hattı (kütüphane): parsel → senaryo → seslendirme → sese göre kurgu → drone render → ses miksi.
 * CLI (scripts/reel.ts) ve panel kuyruğu (scripts/queue-worker.ts) aynı fonksiyonu kullanır.
 *
 *   1. Parsel + çevre (kullanıcının seçtiği noktalar, önbellekli bağlam ya da Google Places + yükseklik verisi)
 *   2. Senaryo: sahne sahne Türkçe anlatım + ilan bilgisi (scripts/story.ts)
 *   3. ElevenLabs seslendirme, kelime zamanlarıyla (cacheDir'de önbellekli: metin değişmedikçe tekrar ödenmez)
 *   4. Kurgu sese göre: uçuşlar anlatım kadar sürer, altyazı kelime kelime (scripts/timeline.ts)
 *   5. Drone render: RunPod worker'ı (sunucu) ya da yerel Chrome (geliştirme)
 *   6. Ses miksi: anlatım + fon müziği (konuşurken kısılır) + geçiş efektleri; hafif renk düzeltme
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareParcel, type ParcelContext, type Poi } from "@arsa/geo";
import { ElevenLabsClient, RunpodClient } from "@arsa/providers";
import type { ParcelInfo } from "../src/types.js";
import { buildStory, numberWords, type Story, type StoryListing } from "./story.js";
import { buildTimeline } from "./timeline.js";

export type ReelStage = "parcel" | "script" | "voice" | "render" | "mix" | "done";

export interface ReelInput {
  parcelText: string;
  /** Önceden hesaplanmış çevre bilgisi (yoksa sorgulanır, sonuçta döner: çağıran önbelleğe yazsın). */
  context?: ParcelContext | null;
  listing?: StoryListing;
  voiceId?: string;
  voice?: boolean;
  music?: boolean;
  render: "runpod" | "local";
  /** Ara dosyalar ve sonuç. */
  workDir: string;
  /** Seslendirme/müzik önbelleği (işler arasında paylaşılır). Varsayılan workDir. */
  cacheDir?: string;
  /** RunPod çıktılarının R2 öneki, ör. "reels/<videoId>". */
  outputPrefix?: string;
  /** Yerel render paralel sayfa. */
  parallel?: number;
  /** RunPod'da kaç parçaya bölünüp aynı anda render edilsin (varsayılan DRONE_RENDER_CHUNKS ya da 3). */
  renderChunks?: number;
  /** Var olan drone.mp4 ile yalnızca ses/miks (geliştirme). */
  skipRender?: boolean;
  log?: (m: string) => void;
  /** Aşama ve aşama içi ilerleme (0..1). */
  onStage?: (stage: ReelStage, progress: number) => void | Promise<void>;
  env?: NodeJS.ProcessEnv;
}

export interface ReelResult {
  reelPath: string;
  droneVideoPath: string;
  durationSec: number;
  context: ParcelContext;
  story: Story;
  /** RunPod çıktıları (R2 linkleri / anahtarları): son kareler inşaat videosunun başlangıcı. */
  keyframes?: { neon?: { url?: string; key?: string }; clean?: { url?: string; key?: string } };
  renderer?: string;
  seconds: Record<string, number>;
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

function run(cmd: string, argv: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const err: string[] = [];
    const p = spawn(cmd, argv, { stdio: ["ignore", "inherit", "pipe"] });
    p.stderr.on("data", (d) => err.push(String(d)));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${c}: ${err.join("").slice(-800)}`))));
  });
}

/** Emlak tanıtım müziği: zarif, sıcak, güven veren; yakın çekimde sakin, uzaklaşırken yükselir, temiz biter. */
export const MUSIC_PROMPT =
  "Elegant luxury real estate showcase background music. Warm felt piano melody over soft lush strings and gentle " +
  "fingerpicked acoustic guitar, airy pads. Calm and aspirational at the start, light modern percussion and a subtle " +
  "pulse join after about 10 seconds, gradual uplifting build to a confident, inspiring peak near the end, then a " +
  "clean resolved final chord. Polished cinematic production, 90 bpm, major key, no vocals, no drops, no risers, no whooshes.";
/** Seslendirme ayarlarının sürümü: ElevenLabs ayarları değişince önbellek yenilenir. */
const VOICE_SETTINGS = "s05-st03-h09-tr-stt";

export async function produceReel(i: ReelInput): Promise<ReelResult> {
  const env = i.env ?? process.env;
  const log = i.log ?? ((m: string) => console.log(m));
  const stage = async (s: ReelStage, p = 0) => i.onStage?.(s, p);
  const cacheDir = i.cacheDir ?? i.workDir;
  await mkdir(i.workDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const seconds: Record<string, number> = {};
  let tStage = Date.now();
  const lap = (name: string) => ((seconds[name] = (Date.now() - tStage) / 1000), (tStage = Date.now()));

  // 1) Parsel + çevre
  await stage("parcel");
  // Kullanıcının seçtiği noktalar varsa onlar; yoksa otomatik (Google Places + yükseklik verisinden deniz).
  const parcel = (await prepareParcel(i.parcelText, {
    cached: i.context,
    pois: i.listing?.pois as Poi[] | undefined, // şema panelde doğrulandı (ReelPoi)
    placesKey: env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_API_KEY,
  })) as unknown as ParcelInfo & ParcelContext;
  const context: ParcelContext = {
    elevation: parcel.elevation,
    elevationSource: parcel.elevationSource,
    address: parcel.address,
    pois: parcel.pois,
  } as ParcelContext;
  log(`Parsel: ${Math.round(parcel.areaM2)} m² · ${parcel.pois.length} çevre noktası`);
  lap("parcel");

  // 2) Senaryo
  await stage("script");
  const story = buildStory(parcel, i.listing);
  for (const s of story.scenes) log(`  ${s.id.padEnd(8)} ${s.text}`);

  // 3) Seslendirme (ElevenLabs)
  const elKey = env.ELEVENLABS_API_KEY;
  const model = env.ELEVENLABS_MODEL || "eleven_v3"; // v3: Türkçe sayıları ("on bir dönüm") net söylüyor
  const el = elKey ? new ElevenLabsClient({ apiKey: elKey, voiceId: i.voiceId || env.ELEVENLABS_VOICE_ID, model }) : null;
  if (el && i.voice !== false) {
    await stage("voice");
    const voiceId = await el.resolveVoice();
    for (const [k, s] of story.scenes.entries()) {
      const mp3 = join(cacheDir, `voice-${hash(`${voiceId}|${model}|${VOICE_SETTINGS}|${s.text}`)}.mp3`);
      const meta = mp3.replace(/\.mp3$/, ".json");
      if (!existsSync(meta)) {
        // Seslendirme bazen bir kelimeyi yanlış okur ("Ezine" → "Izına"): kayıt yazıya çevrilip metinle
        // karşılaştırılır, farklıysa yeniden üretilir (en fazla 3 deneme, en iyisi kullanılır).
        let best: { sp: Awaited<ReturnType<typeof el.speak>>; score: number; heard: string } | null = null;
        for (let attempt = 1; attempt <= 3 && (best?.score ?? 0) < 1; attempt++) {
          const sp = await el.speak(s.text, { previous: story.scenes[k - 1]?.text, next: story.scenes[k + 1]?.text });
          const heard = await el.transcribe(sp.audio).catch(() => null);
          const score = heard === null ? 1 : similarity(spokenWords(s.text), spokenWords(heard));
          if (!best || score > best.score) best = { sp, score, heard: heard ?? "" };
          if (score < 1) log(`  ! ${s.id} okunuşu farklı (${attempt}. deneme): "${heard}"`);
        }
        await writeFile(mp3, best!.sp.audio);
        await writeFile(meta, JSON.stringify({ duration: best!.sp.duration, words: best!.sp.words }));
      }
      s.voice = { ...(JSON.parse(await readFile(meta, "utf8")) as { duration: number; words: [] }), file: mp3 };
      await stage("voice", (k + 1) / story.scenes.length);
    }
  } else if (i.voice !== false) log("! ELEVENLABS_API_KEY yok: seslendirmesiz");

  const timeline = buildTimeline(parcel, story);
  log(`Kurgu: ${timeline.duration.toFixed(1)} sn · ${timeline.cues.length} anlatım · ${timeline.whooshes.length} geçiş`);
  // Render'a dosya yolları gitmez; yalnızca metin, süre, kelime zamanları ve kartlar.
  const renderStory: Story = { ...story, scenes: story.scenes.map((s) => ({ ...s, voice: s.voice && { duration: s.voice.duration, words: s.voice.words } })) };

  // Müzik (önbellekli, işler arasında ortak; istem değişince yenilenir). Geçiş efekti yok: kurgu kesmesiz.
  let music: string | null = null;
  const whoosh: string | null = null;
  if (el && i.music !== false) {
    const len = Math.ceil(timeline.duration) + 1;
    const m = join(cacheDir, `music-${hash(MUSIC_PROMPT)}-${len}.mp3`);
    if (!existsSync(m)) await el.music(MUSIC_PROMPT, len).then((b) => writeFile(m, b)).catch((e) => log(`! müzik üretilemedi: ${String(e).slice(0, 160)}`));
    if (existsSync(m)) music = m;
  }
  lap("voice");

  // 4) Drone render
  await stage("render");
  const droneVideo = join(i.workDir, "drone.mp4");
  let keyframes: ReelResult["keyframes"];
  let renderer: string | undefined;
  if (i.skipRender) {
    if (!existsSync(droneVideo)) throw new Error(`skipRender: ${droneVideo} yok`);
  } else if (i.render === "runpod") {
    // Bölünmüş render: kareler parçalara ayrılır, her parça ayrı bir RunPod worker'ında aynı anda çizilir,
    // sonra uç uca eklenir (toplam GPU süresi aynı, bekleme parça sayısına bölünür).
    const client = new RunpodClient(env.RUNPOD_API_KEY!, env.RUNPOD_DRONE_ENDPOINT_ID!);
    const fps = 30;
    const totalFrames = Math.round(timeline.duration * fps);
    const chunks = Math.max(1, Math.min(i.renderChunks ?? Number(env.DRONE_RENDER_CHUNKS ?? 3), Math.ceil(totalFrames / 90)));
    const size = Math.ceil(totalFrames / chunks);
    const ranges = Array.from({ length: chunks }, (_, k) => [k * size, Math.min(totalFrames, (k + 1) * size)] as const).filter(([a0, b0]) => b0 > a0);
    const done = ranges.map(() => 0);
    log(`RunPod: ${totalFrames} kare, ${ranges.length} parça`);
    const job = (a0: number, b0: number) =>
      client.run({
        parcel: i.parcelText,
        context,
        story: renderStory,
        from_frame: a0,
        limit_frames: b0 - a0,
        // Cesium ayarları (RunPod RTX 4090 ölçümleri, EGL): 4 sayfa, MSAA kapalı, karo keskinliği 16 (4 ile gözle fark yok, 2 kat hızlı).
        parallel: Number(env.DRONE_PARALLEL ?? 4),
        msaa: Number(env.DRONE_MSAA ?? 1),
        sse: Number(env.DRONE_SSE ?? 16),
        ...(i.outputPrefix ? { output_prefix: `${i.outputPrefix}/part${a0}` } : {}),
      });
    const renderPart = async (k: number) => {
      const [a0, b0] = ranges[k]!;
      let jobId = (await job(a0, b0)).id;
      let retried = false;
      for (;;) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await client.status(jobId);
        const progress = s.output as unknown;
        if (s.status === "IN_PROGRESS" && typeof progress === "string") {
          const m = [...progress.matchAll(/(\d+)\/(\d+) kare/g)].pop();
          if (m) {
            done[k] = Number(m[1]);
            await stage("render", done.reduce((x, y) => x + y, 0) / totalFrames);
          }
        }
        if (s.status === "COMPLETED") {
          const out = s.output as any;
          // Rollout sırasında eski sürümlü bir worker kurguyu/aralığı yok sayabilir: kare sayısı tutmalı.
          if (out.frames !== b0 - a0) {
            if (retried) throw new Error(`Drone worker kurguyu uygulamadı (${out.frames}/${b0 - a0} kare): worker sürümü güncel değil`);
            retried = true;
            jobId = (await job(a0, b0)).id;
            log(`Parça ${k + 1}: ${out.frames} kare (beklenen ${b0 - a0}) — eski sürüm olabilir, yeniden: ${jobId}`);
            continue;
          }
          const v = out.video as { url?: string; base64?: string };
          const file = join(i.workDir, `drone-part${k}.mp4`);
          await writeFile(file, v.base64 ? Buffer.from(v.base64, "base64") : Buffer.from(await (await fetch(v.url!)).arrayBuffer()));
          if (out.errors?.length) log(`Parça ${k + 1} uyarıları: ${out.errors.slice(0, 3).join(" | ").slice(0, 300)}`);
          log(`Parça ${k + 1}/${ranges.length} hazır (${a0}–${b0}) · ${((s.executionTime ?? 0) / 1000).toFixed(0)} sn`);
          return { file, out };
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) {
          // Rollout sırasında iptal edilen işler olur: bir kez yeniden dene.
          if (!retried && s.status !== "FAILED") {
            retried = true;
            jobId = (await job(a0, b0)).id;
            log(`Parça ${k + 1}: ${s.status}, yeniden: ${jobId}`);
            continue;
          }
          throw new Error(`Drone render başarısız (parça ${k + 1}, ${s.status}): ${typeof s.error === "string" ? s.error : JSON.stringify(s.error ?? "")}`.slice(0, 1500));
        }
      }
    };
    const parts = await Promise.all(ranges.map((_, k) => renderPart(k)));
    const list = join(i.workDir, "parts.txt");
    await writeFile(list, parts.map((x) => `file '${x.file.replace(/'/g, "'\\''")}'`).join("\n"));
    await run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", droneVideo]);
    const lastOut = parts[parts.length - 1]!.out;
    keyframes = { neon: lastOut.keyframe_neon, clean: lastOut.keyframe_clean };
    renderer = lastOut.renderer;
  } else {
    // Yerel render (geliştirme): Chrome + Playwright yalnızca burada yüklenir.
    const { renderDrone } = await import("./render.js");
    const key = env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("GOOGLE_MAPS_API_KEY yok");
    const r = await renderDrone({ parcel, googleKey: key, outDir: i.workDir, parallel: i.parallel ?? 8, story: renderStory, log });
    renderer = r.renderer;
  }
  lap("render");

  // 5) Ses miksi + renk düzeltme
  await stage("mix");
  const reelPath = join(i.workDir, "reel.mp4");
  await mix({ video: droneVideo, out: reelPath, duration: timeline.duration, cues: timeline.cues, whooshes: timeline.whooshes, music, whoosh });
  lap("mix");
  await stage("done", 1);
  return { reelPath, droneVideoPath: droneVideo, durationSec: timeline.duration, context, story, keyframes, renderer, seconds };
}

/** Karşılaştırma için kelimeler: küçük harf, noktalamasız, rakamlar Türkçe okunuşuyla ("16,2" → "on altı virgül iki"). */
function spokenWords(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .replace(/(\d+)(?:,(\d+))?/g, (_, a: string, b?: string) => `${numberWords(Number(a))}${b ? ` virgül ${numberWords(Number(b))}` : ""}`)
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Kelime dizilerinin benzerliği (en uzun ortak alt dizi / uzun olanın boyu): 1 = birebir. */
function similarity(a: string[], b: string[]) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  return dp[a.length]![b.length]! / Math.max(1, a.length, b.length);
}

/** Anlatım + müzik (anlatımda kısılır) + geçiş efektleri; videoya hafif renk düzeltme. */
async function mix(o: {
  video: string;
  out: string;
  duration: number;
  cues: { at: number; file?: string }[];
  whooshes: number[];
  music: string | null;
  whoosh: string | null;
}) {
  const D = o.duration;
  const inputs: string[] = ["-i", o.video];
  const filters: string[] = [];
  const buses: string[] = [];
  let n = 1;
  const voiceCues = o.cues.filter((c) => c.file);
  if (voiceCues.length) {
    const labels = voiceCues.map((c, k) => {
      inputs.push("-i", c.file!);
      const ms = Math.round(c.at * 1000);
      filters.push(`[${n++}:a]adelay=${ms}|${ms},aresample=44100[v${k}]`);
      return `[v${k}]`;
    });
    filters.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0,volume=1.15,asplit=2[voice][vsc]`);
    buses.push("[voice]");
  }
  if (o.music) {
    inputs.push("-i", o.music);
    const m = n++;
    filters.push(`[${m}:a]atrim=0:${D.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${(D - 1.8).toFixed(2)}:d=1.8,volume=0.5[mus]`);
    if (voiceCues.length) {
      // Anlatım varken müzik kısılır (ducking).
      filters.push(`[mus][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[mduck]`);
      buses.push("[mduck]");
    } else buses.push("[mus]");
  } else if (voiceCues.length) filters.push(`[vsc]anullsink`);
  if (o.whoosh && o.whooshes.length) {
    inputs.push("-i", o.whoosh);
    const w = n++;
    const k = o.whooshes.length;
    filters.push(`[${w}:a]asplit=${k}${o.whooshes.map((_, j) => `[w${j}]`).join("")}`);
    o.whooshes.forEach((t, j) => {
      const ms = Math.max(0, Math.round((t - 0.35) * 1000));
      filters.push(`[w${j}]adelay=${ms}|${ms},volume=0.45[wd${j}]`);
    });
    filters.push(`${o.whooshes.map((_, j) => `[wd${j}]`).join("")}amix=inputs=${k}:normalize=0[wh]`);
    buses.push("[wh]");
  }
  const ff = ["-v", "error", "-y", ...inputs];
  if (buses.length) {
    filters.push(`${buses.join("")}amix=inputs=${buses.length}:normalize=0,alimiter=limit=0.95,apad[aout]`);
    ff.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
  } else ff.push("-map", "0:v");
  // Siyahtan açılış ve sona yumuşak kararma (kesmesiz kurgunun tek "geçişi").
  const fades = `fade=t=in:st=0:d=0.5,fade=t=out:st=${(D - 0.7).toFixed(2)}:d=0.7`;
  // Renk doğal bırakılır (renk düzeltmesi/vinyet yok); yalnızca açılış/kapanış kararması.
  ff.push("-vf", fades, "-c:v", "libx264", "-crf", "19", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", D.toFixed(2), o.out);
  await run("ffmpeg", ff);
}
