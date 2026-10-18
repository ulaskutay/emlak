/** Şablon üretim hatlarının ortak parçaları: iş bağlamı, ffmpeg, RunPod bekleme, müzik, yazı. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Video } from "@arsa/db";
import { MUSIC_PROMPT } from "@arsa/drone-studio/pipeline";
import { ElevenLabsClient, type R2, type RunpodClient } from "@arsa/providers";

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
