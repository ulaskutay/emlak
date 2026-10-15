/**
 * Arsa Reels üretim hattı (kütüphane): parsel → senaryo → seslendirme → sese göre kurgu → drone render → ses miksi.
 * CLI (scripts/reel.ts) ve panel kuyruğu (scripts/queue-worker.ts) aynı fonksiyonu kullanır.
 *
 *   1. Parsel + çevre (verilen önbellekli bağlam ya da Overpass/Nominatim)
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
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { ElevenLabsClient, RunpodClient } from "@arsa/providers";
import type { ParcelInfo } from "../src/types.js";
import { buildStory, type Story, type StoryListing } from "./story.js";
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

const MUSIC_PROMPT =
  "Cinematic, uplifting modern real estate drone video background. Warm ambient pads, soft piano, light percussion, " +
  "gentle build, hopeful and premium mood, no vocals, steady 100 bpm, clean ending.";

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
  const parcel = (await prepareParcel(i.parcelText, { cached: i.context })) as unknown as ParcelInfo & ParcelContext;
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
  const model = env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  const el = elKey ? new ElevenLabsClient({ apiKey: elKey, voiceId: i.voiceId || env.ELEVENLABS_VOICE_ID, model }) : null;
  if (el && i.voice !== false) {
    await stage("voice");
    const voiceId = await el.resolveVoice();
    for (const [k, s] of story.scenes.entries()) {
      const mp3 = join(cacheDir, `voice-${hash(`${voiceId}|${model}|${s.text}`)}.mp3`);
      const meta = mp3.replace(/\.mp3$/, ".json");
      if (!existsSync(meta)) {
        const sp = await el.speak(s.text, { previous: story.scenes[k - 1]?.text, next: story.scenes[k + 1]?.text });
        await writeFile(mp3, sp.audio);
        await writeFile(meta, JSON.stringify({ duration: sp.duration, words: sp.words }));
      }
      s.voice = { ...(JSON.parse(await readFile(meta, "utf8")) as { duration: number; words: [] }), file: mp3 };
      await stage("voice", (k + 1) / story.scenes.length);
    }
  } else if (i.voice !== false) log("! ELEVENLABS_API_KEY yok: seslendirmesiz");

  const timeline = buildTimeline(parcel, story);
  log(`Kurgu: ${timeline.duration.toFixed(1)} sn · ${timeline.cues.length} anlatım · ${timeline.whooshes.length} geçiş`);
  // Render'a dosya yolları gitmez; yalnızca metin, süre, kelime zamanları ve kartlar.
  const renderStory: Story = { ...story, scenes: story.scenes.map((s) => ({ ...s, voice: s.voice && { duration: s.voice.duration, words: s.voice.words } })) };

  // Müzik ve geçiş efekti (önbellekli, işler arasında ortak)
  let music: string | null = null;
  let whoosh: string | null = null;
  if (el && i.music !== false) {
    const len = Math.ceil(timeline.duration) + 2;
    const m = join(cacheDir, `music-${len}.mp3`);
    if (!existsSync(m)) await el.music(MUSIC_PROMPT, len).then((b) => writeFile(m, b)).catch((e) => log(`! müzik üretilemedi: ${String(e).slice(0, 160)}`));
    if (existsSync(m)) music = m;
    const w = join(cacheDir, "whoosh.mp3");
    if (!existsSync(w))
      await el
        .soundEffect("Smooth cinematic air whoosh transition, drone flying fast past the camera, clean, no music", 1.2)
        .then((b) => writeFile(w, b))
        .catch((e) => log(`! efekt üretilemedi: ${String(e).slice(0, 160)}`));
    if (existsSync(w)) whoosh = w;
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
    const client = new RunpodClient(env.RUNPOD_API_KEY!, env.RUNPOD_DRONE_ENDPOINT_ID!);
    const job = await client.run({ parcel: i.parcelText, context, story: renderStory, ...(i.outputPrefix ? { output_prefix: i.outputPrefix } : {}) });
    log(`RunPod işi ${job.id}`);
    let last = "";
    let retried = false;
    let jobId = job.id;
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      const s = await client.status(jobId);
      const progress = s.output as unknown;
      if (s.status === "IN_PROGRESS" && typeof progress === "string") {
        const line = progress.trim().split("\n").pop() ?? "";
        if (line !== last) log(`  │ ${(last = line)}`);
        const m = [...progress.matchAll(/(\d+)\/(\d+) kare/g)].pop();
        if (m) await stage("render", Number(m[1]) / Number(m[2]));
      }
      if (s.status === "COMPLETED") {
        const out = s.output as any;
        // Rollout sırasında eski sürümlü bir worker senaryoyu yok sayabilir: kare sayısı kurguyla tutmalı.
        const expected = Math.round(timeline.duration * 30);
        if (out.frames !== expected) {
          if (!retried) {
            retried = true;
            jobId = (await client.run({ parcel: i.parcelText, context, story: renderStory, ...(i.outputPrefix ? { output_prefix: i.outputPrefix } : {}) })).id;
            log(`Worker kurguyu uygulamadı (${out.frames} kare, beklenen ${expected}) — eski sürüm olabilir, yeniden: ${jobId}`);
            continue;
          }
          throw new Error(`Drone worker kurguyu uygulamadı (${out.frames}/${expected} kare): worker sürümü güncel değil`);
        }
        const v = out.video as { url?: string; base64?: string };
        const buf = v.base64 ? Buffer.from(v.base64, "base64") : Buffer.from(await (await fetch(v.url!)).arrayBuffer());
        await writeFile(droneVideo, buf);
        keyframes = { neon: out.keyframe_neon, clean: out.keyframe_clean };
        renderer = out.renderer;
        log(`Render: ${renderer} · ${((s.executionTime ?? 0) / 1000).toFixed(0)} sn`);
        break;
      }
      if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) {
        // Rollout sırasında iptal edilen işler olur: bir kez yeniden dene.
        if (!retried && s.status !== "FAILED") {
          retried = true;
          jobId = (await client.run({ parcel: i.parcelText, context, story: renderStory, ...(i.outputPrefix ? { output_prefix: i.outputPrefix } : {}) })).id;
          log(`RunPod işi ${s.status}, yeniden: ${jobId}`);
          continue;
        }
        throw new Error(`Drone render başarısız (${s.status}): ${typeof s.error === "string" ? s.error : JSON.stringify(s.error ?? "")}`.slice(0, 1500));
      }
    }
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
    filters.push(`[${m}:a]atrim=0:${D.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${(D - 2.5).toFixed(2)}:d=2.5,volume=0.5[mus]`);
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
  // Uydu görüntüsü biraz soluk: kontrast ve doygunluk hafifçe artırılır.
  ff.push("-vf", "eq=contrast=1.05:saturation=1.12,unsharp=5:5:0.35:5:5:0", "-c:v", "libx264", "-crf", "19", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", D.toFixed(2), o.out);
  await run("ffmpeg", ff);
}
