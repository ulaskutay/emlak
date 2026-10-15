/**
 * İlan videosu (MVP): storyboard JSON'undaki AI sahnelerini RunPod'da paralel üretir,
 * ffmpeg ile hedef formata ölçekleyip yazıları ekler ve tek bir mp4'te birleştirir.
 * Remotion şablonları (Faz 2) gelene kadar geçici kompozisyon katmanıdır.
 *
 *   pnpm listing-video -- --storyboard assets/listings/<id>/storyboard.json
 *
 * Storyboard'daki fotoğraf yolları storyboard dosyasına göre görecelidir.
 * Üretilen klipler <listing>/clips/ altına, final video <listing>/<id>-<format>.mp4 olarak yazılır.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { MODEL_PROFILES, RunpodClient, RunpodVideoProvider, type ModelProfile } from "@arsa/providers";
import { CameraMove, FORMAT_SPECS, OutputFormat, type AiScene } from "@arsa/shared";
import { z } from "zod";
import { requireEnv } from "./env.js";

const run = promisify(execFile);
const FPS = 24;
const OUT_FPS = 30;
const FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";

const ListingStoryboard = z.object({
  id: z.string(),
  format: OutputFormat,
  /** AI sahnesi süresi; 81 kare için 3.375 sn. */
  sceneSeconds: z.number().default(3.375),
  scenes: z
    .array(
      z.object({
        id: z.string(),
        photo: z.string(),
        camera: CameraMove,
        setting: z.enum(["exterior", "interior"]).default("exterior"),
        /** Kırpım odağı (0 = sol, 1 = sağ). Dikey formatta yatay fotoğraftan bu noktaya göre kesilir. */
        focusX: z.number().min(0).max(1).default(0.5),
        prompt: z.string(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
      }),
    )
    .min(1),
  outro: z.object({ lines: z.array(z.string()).min(1), seconds: z.number().default(3) }).optional(),
});
type ListingStoryboard = z.infer<typeof ListingStoryboard>;

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: { storyboard: { type: "string" }, "skip-existing": { type: "boolean", default: true } },
});
if (!args.storyboard) throw new Error("--storyboard <dosya> gerekli");

// pnpm script'i apps/orchestrator içinde çalışır; göreli yolları depo köküne göre çöz.
const ROOT = resolve(import.meta.dirname, "../../..");
const sbPath = resolve(ROOT, args.storyboard);
const sbDir = dirname(sbPath);
const sb: ListingStoryboard = ListingStoryboard.parse(JSON.parse(await readFile(sbPath, "utf8")));
const clipsDir = join(sbDir, "clips");
await mkdir(clipsDir, { recursive: true });

const profile = (process.env.RUNPOD_MODEL_PROFILE ?? "hunyuan15_480p") as ModelProfile;
if (!(profile in MODEL_PROFILES)) throw new Error(`Bilinmeyen RUNPOD_MODEL_PROFILE: ${profile}`);
const client = new RunpodClient(requireEnv("RUNPOD_API_KEY"), requireEnv("RUNPOD_VIDEO_ENDPOINT_ID"));
const provider = new RunpodVideoProvider(client, profile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const activeJobs = new Set<string>();
process.on("SIGINT", async () => {
  console.log(`\nDurduruldu, ${activeJobs.size} iş iptal ediliyor...`);
  await Promise.allSettled([...activeJobs].map((id) => client.cancel(id)));
  process.exit(130);
});

async function generateClip(scene: ListingStoryboard["scenes"][number], index: number): Promise<string> {
  const out = join(clipsDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.mp4`);
  if (args["skip-existing"] && existsSync(out)) {
    console.log(`[${scene.id}] mevcut klip kullanılıyor`);
    return out;
  }
  const photo = await cropToFormat(resolve(sbDir, scene.photo), scene.focusX);
  const aiScene: AiScene = {
    id: scene.id,
    type: "ai_photo_motion",
    durationSec: sb.sceneSeconds,
    photoUrl: `data:image/jpeg;base64,${photo.toString("base64")}`,
    camera: scene.camera,
    setting: scene.setting,
    prompt: scene.prompt,
  };
  const t0 = Date.now();
  const job = await provider.submit({ projectId: sb.id, scene: aiScene, format: sb.format, quality: "preview", seed: index });
  activeJobs.add(job.externalId);
  console.log(`[${scene.id}] gönderildi: ${job.externalId}`);
  for (;;) {
    await sleep(3000);
    const s = await client.status(job.externalId);
    if (s.status === "COMPLETED") {
      activeJobs.delete(job.externalId);
      const b64 = s.output?.video_base64;
      if (!b64) throw new Error(`[${scene.id}] çıktı yok (R2 kuruluysa video_url: ${s.output?.video_url})`);
      await writeFile(out, Buffer.from(b64, "base64"));
      console.log(`[${scene.id}] tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn (gpu ${s.output?.timings?.generate_seconds} sn)`);
      return out;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) {
      activeJobs.delete(job.externalId);
      throw new Error(`[${scene.id}] ${s.status}: ${s.error ?? s.output?.error ?? ""}`);
    }
  }
}

/** Fotoğrafı hedef en-boy oranına focusX'e göre kırpar (worker'ın merkezden kırpması devre dışı kalır). */
async function cropToFormat(photoPath: string, focusX: number): Promise<Buffer> {
  const { width: W, height: H } = FORMAT_SPECS[sb.format];
  const out = join(clipsDir, `.crop-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  const ratio = `${W}/${H}`;
  await run("ffmpeg", [
    "-v", "error", "-y", "-i", photoPath,
    "-vf",
    `crop='if(gt(iw/ih,${ratio}),ih*${ratio},iw)':'if(gt(iw/ih,${ratio}),ih,iw/(${ratio}))':` +
      `'(iw-ow)*${focusX}':'(ih-oh)/2'`,
    "-q:v", "2", out,
  ]);
  const buf = await readFile(out);
  await rm(out, { force: true });
  return buf;
}

/** ffmpeg drawtext için kaçış: ' : \ % karakterleri. */
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");

async function compose(clips: string[]): Promise<string> {
  const { width: W, height: H } = FORMAT_SPECS[sb.format];
  const inputs: string[] = [];
  const filters: string[] = [];
  const titleSize = Math.round(W * 0.075);
  const subSize = Math.round(W * 0.045);

  clips.forEach((clip, i) => {
    const scene = sb.scenes[i]!;
    inputs.push("-i", clip);
    const text: string[] = [];
    if (scene.title) {
      text.push(
        `drawtext=fontfile='${FONT}':text='${esc(scene.title)}':fontsize=${titleSize}:fontcolor=white:` +
          `borderw=5:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.70:alpha='min(1,t*4)'`,
      );
    }
    if (scene.subtitle) {
      text.push(
        `drawtext=fontfile='${FONT}':text='${esc(scene.subtitle)}':fontsize=${subSize}:fontcolor=0xFFD54A:` +
          `borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.70+${Math.round(titleSize * 1.4)}:alpha='min(1,max(0,(t-0.25)*4))'`,
      );
    }
    filters.push(
      `[${i}:v]scale=${W}:${H}:flags=lanczos,setsar=1,fps=${OUT_FPS},format=yuv420p` +
        (text.length ? `,${text.join(",")}` : "") +
        `[v${i}]`,
    );
  });

  let count = clips.length;
  if (sb.outro) {
    const n = sb.outro.lines.length;
    const lineH = Math.round(titleSize * 1.5);
    const top = Math.round(H / 2 - (n * lineH) / 2);
    const lines = sb.outro.lines.map(
      (l, j) =>
        `drawtext=fontfile='${FONT}':text='${esc(l)}':fontsize=${j === 0 ? titleSize : subSize}:` +
        `fontcolor=${j === 0 ? "0xFFD54A" : "white"}:x=(w-text_w)/2:y=${top + j * lineH}:alpha='min(1,max(0,(t-${j * 0.2})*4))'`,
    );
    filters.push(
      `color=c=0x111111:s=${W}x${H}:r=${OUT_FPS}:d=${sb.outro.seconds},format=yuv420p,${lines.join(",")}[v${count}]`,
    );
    count += 1;
  }

  filters.push(`${Array.from({ length: count }, (_, i) => `[v${i}]`).join("")}concat=n=${count}:v=1:a=0[out]`);
  const out = join(sbDir, `${sb.id}-${sb.format}.mp4`);
  await run("ffmpeg", [
    "-v", "error", "-y",
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "[out]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart",
    out,
  ]);
  return out;
}

const t0 = Date.now();
console.log(`${sb.scenes.length} sahne paralel üretiliyor (endpoint max worker kadar aynı anda)...`);
const clips = await Promise.all(sb.scenes.map((s, i) => generateClip(s, i)));
console.log(`Klipler hazır: ${((Date.now() - t0) / 1000).toFixed(0)} sn. Birleştiriliyor...`);
const out = await compose(clips);
console.log(`Video hazır (${((Date.now() - t0) / 1000).toFixed(0)} sn): ${out}`);
