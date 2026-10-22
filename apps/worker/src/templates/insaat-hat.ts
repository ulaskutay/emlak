/**
 * İnşaat videosunun görüntü hattı (worker şablonu ve yerel CLI ortak kullanır):
 * arsanın yandan yakın karesinden bitmiş yapıya ~20 sn'lik inşaat timelapse'i.
 *
 *   1) Qwen: yan kare netleştirilir (Cesium karosu bulanık; fotogerçekçi drone fotoğrafına).
 *   2) Qwen: bitmiş yapı karesi (hedef; kat sayısı çevreye göre boyla da tarif edilir).
 *   3) Qwen: hedef kareden kazı karesi (bina yerine temel çukuru); şantiye renge göre maskelenip boş arsaya
 *      yapıştırılır (Qwen bahçe ve otoparkı bırakıyordu, prompt'la da silmiyordu).
 *   4) Kaba klip: Wan ilk/son kare, kazı → bitmiş yapı (~5 sn, bütün aşamalar hızlıca).
 *   5) Ara kareler: kaba klipte toplam görüntü değişimi eşit parçalara bölünür (Wan binayı erken kuruyor).
 *   6) İnce klipler: ardışık iki ara kare arasında Wan ilk/son kare (paralel); 1. klip boş arsa → kazı.
 *   7) Klip içi tempo: ara kare üretimi + değişime göre kare seçimi (Wan değişimi klibin başına yığıyor).
 * Her klibin başı ve sonu sabit olduğundan zincirde kayma birikmez (yalnız ilk kareden zincirde bina bozuluyordu).
 * Wan klipleri ham 720p üretilir, büyütme en sonda bir kez (her klibi büyütüp tekrar Wan'a vermek keskinleştirmeyi
 * katlıyor, görüntü yağlı boyaya dönüyordu). Ara çıktılar name() ile adlanır; var olan adımlar tekrar üretilmez.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RunpodClient } from "@arsa/providers";
import { buildingSpec, type BuildingType } from "@arsa/shared";
import { agentCard, type AgentCardInput } from "./agent-card.js";
import { compositeSite } from "./insaat-kare.js";

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Çıktı boyutu (9:16) ve Wan klibi: 81 kare @ 16 fps ≈ 5 sn, 720p. */
export const W = 1080;
export const H = 1920;
export const WAN_FRAMES = 81;
export const WAN_FPS = 16;
export const WAN_SIZE = [720, 1280] as const;
export const OUT_FPS = 30;
/** Bir ince klibin süresi (sn). */
export const SEGMENT_SECONDS = WAN_FRAMES / WAN_FPS;

/** Geçici ağ hatalarında tekrar dener: paralel büyük (base64) isteklerde RunPod HTTP/2 akışı kesebiliyor (ENHANCE_YOUR_CALM). */
async function retry<T>(what: string, fn: () => Promise<T>, log: (m: string) => void, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      log(`[${what}] ağ hatası, ${i * 5} sn sonra tekrar: ${String((e as Error).cause ?? e).split("\n")[0]}`);
      await sleep(i * 5000);
    }
  }
}

export async function runJob(client: RunpodClient, input: unknown, label: string, log: (m: string) => void) {
  const ts = Date.now();
  const job = await retry(label, () => client.run(input), log);
  log(`[${label}] gönderildi: ${job.id}`);
  for (;;) {
    await sleep(3000);
    const s = await retry(label, () => client.status(job.id), log);
    if (s.status === "COMPLETED") {
      const out = s.output as Record<string, any>;
      log(`[${label}] tamam: ${((Date.now() - ts) / 1000).toFixed(0)} sn (gpu ${out.timings?.generate_seconds} sn)`);
      return out;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status))
      throw new Error(`${label} başarısız (${s.status}): ${s.error ?? s.output?.error ?? ""}`.slice(0, 800));
  }
}

const dataUrl = async (path: string) => `data:image/png;base64,${(await readFile(path)).toString("base64")}`;

export interface Gpu {
  qwen: RunpodClient;
  wan: RunpodClient;
  log: (m: string) => void;
}

/** Qwen-Image-Edit: görseli talimatla düzenler (çıktı girdiyle aynı boyutta PNG). */
export async function qwenEdit(gpu: Gpu, image: string, prompt: string, out: string, label: string, seed = 7, cfg = 3) {
  if (existsSync(out)) return out;
  // true_cfg_scale 4 → 3: daha düşük CFG'de aşırı doygunluk ve keskinlik azalıyor.
  const r = await runJob(gpu.qwen, { image_url: await dataUrl(image), width: W, height: H, seed, true_cfg_scale: cfg, prompt }, label, gpu.log);
  await writeFile(out, Buffer.from(r.image_base64, "base64"));
  return out;
}

/** Wan 2.2 ilk/son kare klibi, ham 720p (büyütmesiz). */
export async function wanClip(gpu: Gpu, first: string, last: string, prompt: string, out: string, label: string, seed = 7) {
  if (existsSync(out)) return out;
  const r = await runJob(
    gpu.wan,
    {
      image_url: await dataUrl(first),
      last_image_url: await dataUrl(last),
      width: WAN_SIZE[0],
      height: WAN_SIZE[1],
      num_frames: WAN_FRAMES,
      frame_rate: WAN_FPS,
      num_steps: 4,
      seed,
      prompt,
    },
    label,
    gpu.log,
  );
  await writeFile(out, Buffer.from(r.video_base64, "base64"));
  return out;
}

// ——— Prompt'lar ———

export const ENHANCE_PROMPT =
  "Turn this blurry 3D map render into a sharp, photorealistic aerial drone photograph taken from the same position. " +
  "Keep the exact same camera angle, composition and horizon. Keep every road, dirt track, tree position, the forest, the houses in the background and the hills exactly where they are. " +
  "The empty plot of land in the foreground stays empty land. Add realistic detail: individual grass, soil texture, tree foliage with natural shadows, clear house roofs. " +
  "Bright natural daylight, clear blue sky, high detail, 4K drone photo. No text, no watermark, no logo.";

export function endPrompt(type: BuildingType, floors: number) {
  const spec = buildingSpec(type, floors);
  const tall = type === "konut" || type === "ticari";
  return (
    `Build ${spec.edit} in the middle of the empty plot in the foreground. ` +
    (tall
      ? `It is a low-rise building with exactly ${floors} floors: ${floors} rows of windows from the ground to the flat roof, no more. ` +
        `It is only about ${floors * 3} meters tall, roughly ${Math.max(2, Math.round(floors / 1.5))} times the height of the trees around it, and wider than it is tall. `
      : "") +
    "The site is finished and clean: no construction equipment, no bare soil, neat lawns, young trees, paved paths and a small parking area around the building. " +
    "It sits naturally on the ground and matches the drone camera perspective, scale, shadows and sunlight of the photo. " +
    "Keep the camera angle, the roads, the trees outside the plot, the houses in the background and the hills exactly unchanged, with the same natural colors and softness as the photo. " +
    "Photorealistic aerial drone photo."
  );
}

export const KAZI_PROMPT =
  "Remove the building, its garden, paths and parking lot and turn that area into an early-stage construction site seen from the same drone camera: " +
  "a large excavated rectangular foundation pit of bare brown soil exactly where the building stood, with the first grey concrete foundation slab and steel rebar inside, " +
  "two yellow excavators, a dump truck and piles of excavated earth beside the pit, and the base of a yellow tower crane. No building above the ground yet. " +
  "Everything outside the construction site stays exactly unchanged: the grassland and trees, the roads, the houses in the background and the hills, with the same natural colors and light. " +
  "Photorealistic aerial drone photo.";

const CAMERA =
  "Fixed drone camera, no camera movement. The roads, the trees outside the plot, the houses in the background and the hills stay exactly unchanged. " +
  "Photorealistic, sharp, high detail.";

const coarsePrompt = (building: string) =>
  "Fast construction time-lapse. From the foundation pit, a reinforced concrete frame rises floor by floor with scaffolding and a tower crane, " +
  "the walls, windows and facade are completed, the crane, scaffolding and machines are removed " +
  `and the site is landscaped, revealing ${building}. Workers and trucks move quickly. ` + CAMERA;

const FIRST_STAGE =
  "excavators, bulldozers and dump trucks clear the land and dig the foundation pit, a tower crane is erected, steel rebar is laid and the concrete foundation is poured";
const STAGES = [
  "the first reinforced concrete columns and slabs rise from the foundation, with rebar and formwork",
  "the concrete frame rises floor by floor with scaffolding and the tower crane lifting materials",
  "the frame reaches its full height, brick walls are built and window openings appear",
  "the facade, windows and balconies are completed and the scaffolding is taken down",
  "the crane and machines leave, the soil is levelled, lawns, trees, paths and parking are laid out",
];

/** i. ince klibin prompt'u. Kalan klipler aşamaları birleştirir (az klipte hiçbir aşama atlanmaz). */
function stagePrompt(i: number, n: number, building: string) {
  // 1. klipte bina tarifi yok: tarif verilince Wan önce binayı dikip sonra çukura çeviriyordu.
  if (i === 0) return `Construction time-lapse of an empty field turning into an excavation site: ${FIRST_STAGE}. No building above the ground. ` + "Workers and trucks move steadily, sunlight and shadows shift slowly. " + CAMERA;
  const m = n - 1;
  const from = Math.floor(((i - 1) * STAGES.length) / m);
  const to = Math.max(from + 1, Math.floor((i * STAGES.length) / m));
  return `Construction time-lapse of ${building}: ${STAGES.slice(from, to).join(", then ")}. Workers and trucks move steadily, sunlight and shadows shift slowly. ` + CAMERA;
}

// ——— Tempo ———

/** Ardışık kare farklarının birikimli toplamı (küçük gri kareler üzerinden): klipte ne zaman ne kadar değişim var. */
export async function changeCurve(video: string): Promise<number[]> {
  const w = 72, h = 128;
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], {
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024,
  });
  const buf = stdout as unknown as Buffer;
  const size = w * h;
  const frames = Math.floor(buf.length / size);
  const cum = [0];
  for (let i = 1; i < frames; i++) {
    let d = 0;
    for (let j = 0; j < size; j++) d += Math.abs(buf[i * size + j]! - buf[(i - 1) * size + j]!);
    cum.push(cum[i - 1]! + d / size);
  }
  return cum;
}

/** Klipte toplam değişimi n eşit parçaya bölen kare numaraları (n-1 tane). */
export async function changeAnchors(video: string, n: number): Promise<number[]> {
  const cum = await changeCurve(video);
  const frames = cum.length;
  const total = cum[frames - 1]!;
  const picks: number[] = [];
  for (let k = 1; k < n; k++) {
    let i = cum.findIndex((c) => c >= (total * k) / n);
    // Ardışık ara kareler arasında en az 4 kare: aynı kareden iki ucu sabit klip olmasın.
    i = Math.max(i, (picks.at(-1) ?? 0) + 4);
    picks.push(Math.min(i, frames - 1 - 4 * (n - k)));
  }
  return picks;
}

/**
 * Klip içi tempo: Wan ilk/son kare modunda değişimi klibin başına yığıp sonra bekliyor.
 * Klip ara karelerle 4 kat sıklaştırılır (minterpolate), sonra kareler değişim zamana yayılacak şekilde seçilir.
 * Tam eşit değişim durağan anları tamamen atıp sarsıntı yapar; zamanla yarı yarıya karıştırılır.
 */
export async function retime(input: string, out: string) {
  if (existsSync(out)) return out;
  const dense = out.replace(/\.mp4$/, "-mi.mp4");
  await run("ffmpeg", ["-v", "error", "-y", "-i", input, "-vf", `minterpolate=fps=${WAN_FPS * 4}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`, "-c:v", "libx264", "-crf", "14", "-preset", "fast", dense]);
  const cum = await changeCurve(dense);
  const n = cum.length;
  const total = cum[n - 1]! || 1;
  const g = cum.map((c, i) => 0.5 * (i / (n - 1)) + 0.5 * (c / total));
  const M = Math.round(SEGMENT_SECONDS * OUT_FPS);
  const idx = Array.from({ length: M }, (_, k) => Math.max(0, g.findIndex((v) => v >= k / (M - 1) - 1e-9)));
  const framesDir = await mkdtemp(join(tmpdir(), "insaat-"));
  try {
    await run("ffmpeg", ["-v", "error", "-y", "-i", dense, "-q:v", "2", join(framesDir, "%05d.jpg")]);
    const list = ["ffconcat version 1.0", ...idx.flatMap((i) => [`file '${String(i + 1).padStart(5, "0")}.jpg'`, `duration ${1 / OUT_FPS}`])];
    await writeFile(join(framesDir, "list.txt"), list.join("\n"));
    await run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(framesDir, "list.txt"), "-vf", `fps=${OUT_FPS},format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-preset", "fast", out]);
  } finally {
    await rm(framesDir, { recursive: true, force: true });
    await rm(dense, { force: true });
  }
  return out;
}

/** Klipleri uç uca ekler: her klibin ilk karesi bir öncekinin son karesiyle aynı, tekrar etmesin diye atlanır. Büyütme burada bir kez. */
export async function joinClips(parts: string[], out: string) {
  const chain = parts.map((_, i) => `[${i}:v]${i > 0 ? "trim=start_frame=1,setpts=PTS-STARTPTS," : ""}setsar=1[s${i}]`).join(";");
  await run("ffmpeg", [
    "-v", "error", "-y", ...parts.flatMap((p) => ["-i", p]),
    "-filter_complex", `${chain};${parts.map((_, i) => `[s${i}]`).join("")}concat=n=${parts.length}:v=1:a=0,fps=${OUT_FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p[out]`,
    "-map", "[out]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out,
  ]);
  return out;
}

/**
 * Yan kareden (start) sessiz inşaat videosu. name(x): ara dosyanın yolu.
 * end verilirse (ör. CLI'de aday seçilen bitmiş yapı karesi) Qwen hedef karesi üretilmez.
 */
export async function buildConstruction(o: {
  gpu: Gpu;
  /** Netleştirilmiş yan kare (boş arsa). */
  start: string;
  type: BuildingType;
  floors: number;
  clips: number;
  seed: number;
  name: (x: string) => string;
  end?: string;
  onStage?: (stage: "build" | "timelapse" | "compose", progress?: number) => Promise<void> | void;
}): Promise<string> {
  const { gpu, start, name } = o;
  const N = o.clips;
  const spec = buildingSpec(o.type, o.floors);

  await o.onStage?.("build");
  const end = o.end ?? (await qwenEdit(gpu, start, endPrompt(o.type, o.floors), name("bitis.png"), "qwen bitmiş yapı", o.seed));
  const kaziHam = await qwenEdit(gpu, end, KAZI_PROMPT, name("kazi-ham.png"), "qwen kazı", o.seed);
  const kazi = name("kazi.png");
  if (!existsSync(kazi)) await compositeSite(start, kaziHam, kazi, W, H, name("kazi-maske.png"));

  await o.onStage?.("timelapse", 0);
  const coarse = await wanClip(gpu, kazi, end, coarsePrompt(spec.edit), name("kaba.mp4"), "wan kaba", o.seed);
  await o.onStage?.("timelapse", 1 / (N + 1));
  const picks = await changeAnchors(coarse, N - 1);
  gpu.log(`ara kareler (kaba klipte kare no): ${picks.join(", ")}`);
  const anchors = [start, kazi];
  for (const [k, n] of picks.entries()) {
    const path = name(`ara-${k + 1}.png`);
    if (!existsSync(path)) await run("ffmpeg", ["-v", "error", "-y", "-i", coarse, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", "-update", "1", path]);
    anchors.push(path);
  }
  anchors.push(end);

  let done = 0;
  const raw = await Promise.all(
    // Gönderimler 3 sn arayla: aynı anda 4 büyük istek RunPod'un HTTP/2 sınırına takılıyordu.
    Array.from({ length: N }, (_, i) =>
      sleep(i * 3000)
        .then(() => wanClip(gpu, anchors[i]!, anchors[i + 1]!, stagePrompt(i, N, spec.edit), name(`klip-${i + 1}.mp4`), `wan ${i + 1}/${N}`, o.seed))
        .then(async (p) => {
          await o.onStage?.("timelapse", (1 + ++done) / (N + 1));
          return p;
        }),
    ),
  );
  await o.onStage?.("compose");
  const parts = await Promise.all(raw.map((p) => retime(p, p.replace(/\.mp4$/, "-tempo.mp4"))));
  return joinClips(parts, name(`${N * 5}sn.mp4`));
}

/** Kapanış kartı süresi (sn). */
export const OUTRO_SECONDS = 4;

/**
 * Sonuna emlakçı kapanış kartı ekler (eşya yerleştirme şablonundaki kart: bulanık son kare üstünde fiyat,
 * emlakçı, telefon, "Hemen arayın", logo). Kartın başladığı saniyeyi döndürür (seslendirme ve kartlar ona göre).
 */
export async function appendOutro(video: string, out: string, workDir: string, card: Omit<AgentCardInput, "background" | "seconds">) {
  const lastFrame = join(workDir, "son-kare.png");
  await run("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.1", "-i", video, "-frames:v", "1", "-update", "1", lastFrame]);
  const outro = await agentCard(workDir, { ...card, background: lastFrame, seconds: OUTRO_SECONDS });
  const outroAt = Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video])).stdout.trim());
  await run("ffmpeg", [
    "-v", "error", "-y", "-i", video, "-i", outro,
    "-filter_complex", `[0:v]fps=${OUT_FPS},format=yuv420p,setsar=1[a];[1:v]fps=${OUT_FPS},format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[out]`,
    "-map", "[out]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out,
  ]);
  return { video: out, outroAt };
}
