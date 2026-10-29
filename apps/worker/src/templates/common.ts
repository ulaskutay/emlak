/** Şablon üretim hatlarının ortak parçaları: iş bağlamı, ffmpeg, RunPod bekleme, müzik, yazı. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Video } from "@arsa/db";
import { MUSIC_PROMPT } from "@arsa/drone-studio/pipeline";
import { ElevenLabsClient, type HiggsfieldCli, type R2, type RunpodClient } from "@arsa/providers";
import { stagingEditPrompt, type RoomType, type StagingStyle } from "@arsa/shared";

export interface JobContext {
  video: Video;
  r2: R2;
  workDir: string;
  cacheDir: string;
  log: (m: string) => void;
  /** Aşama (şablonun stages kimliği) ve aşama içi ilerleme 0..1. */
  stage: (stage: string, progress?: number) => Promise<void>;
}

export interface JobResult {
  videoPath: string;
  durationSec: number;
  /** Kapak karesinin saniyesi. */
  posterAt: number;
  stats?: Record<string, unknown>;
}

export function ffmpeg(args: string[]) {
  return new Promise<void>((res, rej) => {
    const err: string[] = [];
    const p = spawn("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "pipe"] });
    p.stderr.on("data", (d) => err.push(String(d)));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${err.join("").slice(-600)}`))));
  });
}

export function probeDuration(path: string) {
  return new Promise<number>((res, rej) => {
    const out: string[] = [];
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]);
    p.stdout.on("data", (d) => out.push(String(d)));
    p.on("close", (c) => (c === 0 ? res(Number(out.join("").trim())) : rej(new Error(`ffprobe ${c}`))));
  });
}

/** drawtext yazı tipi: FFMPEG_FONT ya da sistemde bulunan ilk kalın yazı tipi. */
export const FONT = (() => {
  const candidates = [
    process.env.FFMPEG_FONT,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  ].filter(Boolean) as string[];
  return candidates.find((f) => existsSync(f)) ?? null;
})();

/** ffmpeg drawtext için kaçış: \ ' : karakterleri (% için expansion=none kullanılır). */
export const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:");

/** Ortalanmış, kenarlıklı, belirerek gelen yazı. */
export function drawText(text: string, size: number, y: string, color = "white", delay = 0) {
  if (!FONT) throw new Error("Videoya yazı için yazı tipi bulunamadı: FFMPEG_FONT ayarlayın ya da DejaVu yazı tiplerini kurun");
  return (
    `drawtext=fontfile='${FONT}':expansion=none:text='${esc(text)}':fontsize=${size}:fontcolor=${color}:borderw=5:bordercolor=black@0.85:` +
    `x=(w-text_w)/2:y=${y}:alpha='min(1,max(0,(t-${delay})*3))'`
  );
}

/** Kapanış kartında fiyat: "4.500.000 TL". */
export const priceText = (try_?: number) => (try_ ? `${new Intl.NumberFormat("tr-TR").format(try_)} TL` : undefined);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** RunPod işini gönderip bitene kadar bekler; çıktıyı döner. */
export async function runpodJob(client: RunpodClient, input: unknown, label: string, log: (m: string) => void) {
  const t0 = Date.now();
  const job = await client.run(input);
  log(`[${label}] gönderildi: ${job.id}`);
  for (;;) {
    await sleep(3000);
    const s = await client.status(job.id);
    if (s.status === "COMPLETED") {
      log(`[${label}] tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
      return (s.output ?? {}) as Record<string, any>;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status))
      throw new Error(`${label} başarısız (${s.status}): ${s.error ?? s.output?.error ?? ""}`.slice(0, 800));
  }
}

/** RunPod çıktısındaki dosyayı (base64 ya da link) diske yazar. */
export async function saveOutput(out: Record<string, any>, kind: "video" | "image", path: string) {
  const b64 = out[`${kind}_base64`];
  const url = out[`${kind}_url`];
  if (b64) await writeFile(path, Buffer.from(b64, "base64"));
  else if (url) await writeFile(path, Buffer.from(await (await fetch(url)).arrayBuffer()));
  else throw new Error(`RunPod çıktısında ${kind} yok`);
  return path;
}

export async function download(url: string, path: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`İndirilemedi (${res.status}): ${url.split("?")[0]}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Boş odayı döşeyen model (Higgsfield). 2026-10-29 karşılaştırması: odayı Qwen'den daha birebir korur
 * (eşyasız üst bölgede SSIM 0,89–0,92; Qwen 0,77–0,86), kare ~45 sn, 1k'de 1,5 kredi. GPU kuyruğu/soğuk açılış yok. */
const STAGING_MODEL = "nano_banana_2_1";

/**
 * Boş oda karesini (dikey kırpılmış) döşer; çıktı girdinin boyutuna kırpılır ki Wan'ın ilk/son kareleri hizalı kalsın.
 */
export async function furnishRoom(
  hf: HiggsfieldCli,
  emptyFile: string,
  room: RoomType,
  style: StagingStyle,
  out: string,
  o: { seed: number; label: string; log: (m: string) => void; width?: number; height?: number },
) {
  const res = await hf.generate(
    STAGING_MODEL,
    { params: { prompt: stagingEditPrompt(room, style), aspect_ratio: "9:16", resolution: "1k", seed: o.seed }, media: [["image", emptyFile]] },
    { label: o.label, log: o.log },
  );
  const raw = await download(res.url, `${out}.ham`);
  const w = o.width ?? 720;
  const h = o.height ?? 1280;
  await ffmpeg(["-i", raw, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, "-frames:v", "1", out]);
  return out;
}

/** Higgsfield video: Gemini 360p üretip ByteDance ile 1080p 60 FPS (AIGC ön ayarı) büyütür; 720p'nin üçte biri fiyatına. */
const CLIP_MODEL = "gemini_omni_flash_1_1";
const UPSCALE_MODEL = "bytedance_video_upscale";
export const CLIP_FPS = 60;

/**
 * Tek görselden (ya da ilk/son kareden) dikey klip: Gemini Omni Flash image-to-video → 1080p 60 FPS büyütme.
 * Gemini ses de üretir; çağıran istemde konuşma istemez, kurgu sesi kullanmaz.
 */
export async function geminiClip(
  hf: HiggsfieldCli,
  o: { prompt: string; start: string; end?: string; seconds: number; out: string; label: string; log: (m: string) => void },
) {
  const raw = await hf.generate(
    CLIP_MODEL,
    {
      params: { prompt: o.prompt, mode: "image-to-video", duration: o.seconds, resolution: "360p", aspect_ratio: "9:16" },
      media: [["start-image", o.start], ...(o.end ? [["end-image", o.end] as [string, string]] : [])],
    },
    { label: o.label, log: o.log },
  );
  const clip = await hf.generate(
    UPSCALE_MODEL,
    { params: { model_version: "standard", resolution: "1080p", fps: CLIP_FPS, preset: "aigc" }, media: [["video-references", raw.id]] },
    { label: `büyütme: ${o.label}`, log: o.log },
  );
  return download(clip.url, o.out);
}

/** Fon müziği (ElevenLabs), süreye göre önbellekli. Anahtar yoksa ya da üretilemezse null. */
export async function backgroundMusic(seconds: number, ctx: JobContext): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const len = Math.ceil(seconds);
  const hash = createHash("sha1").update(MUSIC_PROMPT).digest("hex").slice(0, 12);
  const file = join(ctx.cacheDir, `music-${hash}-${len}.mp3`);
  if (existsSync(file)) return file;
  try {
    await writeFile(file, await new ElevenLabsClient({ apiKey: key }).music(MUSIC_PROMPT, len));
    return file;
  } catch (e) {
    ctx.log(`! müzik üretilemedi: ${String(e).slice(0, 160)}`);
    return null;
  }
}

/** Seslendirme (ElevenLabs), metne göre önbellekli. Ses dosyası ve süresi; anahtar yoksa null. */
export async function speakLines(lines: string[], voiceId: string | null, ctx: JobContext): Promise<{ file: string; duration: number }[] | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    ctx.log("! ELEVENLABS_API_KEY yok: seslendirmesiz");
    return null;
  }
  const model = process.env.ELEVENLABS_MODEL || "eleven_v3";
  const el = new ElevenLabsClient({ apiKey: key, voiceId: voiceId || process.env.ELEVENLABS_VOICE_ID, model });
  const voice = await el.resolveVoice();
  const out: { file: string; duration: number }[] = [];
  for (const [i, text] of lines.entries()) {
    const file = join(ctx.cacheDir, `tts-${createHash("sha1").update(`${voice}|${model}|${text}`).digest("hex").slice(0, 16)}.mp3`);
    const meta = file.replace(/\.mp3$/, ".json");
    if (!existsSync(meta)) {
      const sp = await el.speak(text, { previous: lines[i - 1], next: lines[i + 1] });
      await writeFile(file, sp.audio);
      await writeFile(meta, JSON.stringify({ duration: sp.duration }));
    }
    out.push({ file, duration: (JSON.parse(await readFile(meta, "utf8")) as { duration: number }).duration });
  }
  return out;
}

/**
 * Sessiz videoya anlatım ve müzik: anlatımlar verilen saniyelerde başlar, müzik anlatım sırasında kısılır
 * (ducking), sonda kısılarak biter. Hiç ses yoksa sessiz ses izi eklenir.
 */
export async function mixAudio(video: string, cues: { at: number; file: string }[], music: string | null, duration: number, out: string) {
  if (!cues.length) return addMusic(video, music, duration, out);
  const inputs = ["-i", video, ...cues.flatMap((c) => ["-i", c.file])];
  const filters = cues.map((c, k) => {
    const ms = Math.round(c.at * 1000);
    return `[${k + 1}:a]adelay=${ms}|${ms},aresample=44100[v${k}]`;
  });
  filters.push(`${cues.map((_, k) => `[v${k}]`).join("")}amix=inputs=${cues.length}:normalize=0,volume=1.15,asplit=2[voice][vsc]`);
  let buses = "[voice]";
  if (music) {
    inputs.push("-i", music);
    filters.push(
      `[${cues.length + 1}:a]atrim=0:${duration},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5,volume=0.5[mus]`,
      "[mus][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[mduck]",
    );
    buses += "[mduck]";
  } else filters.push("[vsc]anullsink");
  filters.push(`${buses}amix=inputs=${music ? 2 : 1}:normalize=0,alimiter=limit=0.95,apad[aout]`);
  await ffmpeg([
    ...inputs, "-filter_complex", filters.join(";"),
    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(duration), "-movflags", "+faststart", out,
  ]);
  return out;
}

/** Sessiz videoya müziği ekler (sonda 1.5 sn kısılarak biter); müzik yoksa sessiz ses izi. */
export async function addMusic(video: string, music: string | null, duration: number, out: string) {
  if (music) {
    await ffmpeg([
      "-i", video, "-i", music,
      "-filter_complex", `[1:a]atrim=0:${duration},afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5,volume=0.8[a]`,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out,
    ]);
  } else {
    await ffmpeg([
      "-i", video, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart", out,
    ]);
  }
  return out;
}
