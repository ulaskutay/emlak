/**
 * İnşaat videosunun görüntü hattı (worker şablonu ve yerel CLI ortak kullanır):
 * arsanın yandan yakın karesinden bitmiş yapıya ~20 sn'lik inşaat timelapse'i. Üretim Higgsfield'da (2026-10-29).
 *
 *   1) Nano Banana 2.1: yan kare netleştirilir (Cesium karosu bulanık; fotogerçekçi drone fotoğrafına).
 *   2) Nano Banana 2.1: bitmiş yapı karesi (hedef; kat sayısı çevreye göre boyla da tarif edilir).
 *   3) Nano Banana 2.1: hedef kareden kazı karesi (bina yerine temel çukuru); şantiye renge göre maskelenip boş
 *      arsaya yapıştırılır (düzenleme modeli bahçe ve otoparkı bırakabiliyor, prompt'la da silmiyordu).
 *   4) Kling 4.0 ilk/son kare, 720p → ByteDance 1080p 60 FPS (AIGC) büyütme: boş arsa → kazı (1 dilim) ve
 *      kazı → bitmiş yapı (kalan dilimler) iki klip. Kling uzun klipte aşamaları zamana yayıyor, uçları sabit kalıyor.
 *      Kling'in kendi sesi kullanılmaz: istemde "müzik yok" yazsa da şantiye sesi yerine müzik üretiyor (2026-10-29);
 *      şantiye sesi insaat-ses.ts'te aşamalara göre ayrı üretilir.
 * Ara çıktılar name() ile adlanır; var olan adımlar tekrar üretilmez.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { HiggsfieldCli, RunpodClient } from "@arsa/providers";
import { buildingSpec, type BuildingType } from "@arsa/shared";
import { agentCard, type AgentCardInput } from "./agent-card.js";
import { CLIP_FPS, download, upscale } from "./common.js";
import { compositeSite } from "./insaat-kare.js";

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Çıktı boyutu (9:16). */
export const W = 1080;
export const H = 1920;
/** Klipler 60 FPS büyütülür; kurgu da 60 FPS. */
export const OUT_FPS = CLIP_FPS;
/** Bir inşaat diliminin süresi (sn): ses de bu dilimlere göre yerleşir (insaat-ses.ts). */
export const SEGMENT_SECONDS = 5;
/** Görsel düzenleme ve video modelleri (Higgsfield). */
const EDIT_MODEL = "nano_banana_2_1";
const CLIP_MODEL = "kling4_0";

/** Geçici ağ hatalarında tekrar dener (RunPod drone worker'ı: yan kare). Paralel büyük isteklerde HTTP/2 akışı kesilebiliyor. */
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

export interface Gen {
  hf: HiggsfieldCli;
  log: (m: string) => void;
}

/** Görseli talimatla düzenler (Nano Banana 2.1, 2k); çıktı W×H'ye kırpılır ki klip uçları hizalı kalsın. */
export async function editImage(gen: Gen, image: string, prompt: string, out: string, label: string, seed = 7) {
  if (existsSync(out)) return out;
  const r = await gen.hf.generate(
    EDIT_MODEL,
    { params: { prompt, aspect_ratio: "9:16", resolution: "2k", seed }, media: [["image", image]] },
    { label, log: gen.log },
  );
  const raw = await download(r.url, `${out}.ham`);
  await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, "-frames:v", "1", "-update", "1", out]);
  return out;
}

/** Kling 4.0 ilk/son kare klibi: 720p üretilir (1080p'den ucuz), ByteDance ile 1080p 60 FPS (AIGC) büyütülür. */
export async function clip(gen: Gen, first: string, last: string, prompt: string, seconds: number, out: string, label: string) {
  if (existsSync(out)) return out;
  const r = await gen.hf.generate(
    CLIP_MODEL,
    {
      params: { prompt, mode: "image-to-video", duration: seconds, resolution: "720p", aspect_ratio: "9:16" },
      media: [["start-image", first], ["end-image", last]],
    },
    { label, log: gen.log },
  );
  return upscale(gen.hf, r.id, out, `büyütme: ${label}`, gen.log);
}

/**
 * Bitmiş yapı karesi: iki aday üretilir, parselin dışında (gökyüzü/arka plan ve ön plandaki yollar) başlangıç
 * karesine en çok benzeyen seçilir. Model zaman zaman yolları, ağaçları siler ya da binayı kadraja taşırıyordu.
 */
export async function pickEnd(gen: Gen, start: string, prompt: string, out: string, seed: number) {
  if (existsSync(out)) return out;
  const cands = await Promise.all([0, 1].map((k) => editImage(gen, start, prompt, out.replace(/\.png$/, `-aday${k + 1}.png`), `bitmiş yapı ${k + 1}`, seed + k)));
  const score = async (f: string) => {
    // Üst %38 (arka plan) ve alt %14 (ön plandaki yollar) bölgelerinin SSIM ortalaması.
    const ssim = async (y: string, h: string) => {
      const { stderr } = await run("ffmpeg", [
        "-i", start, "-i", f, "-filter_complex",
        `[0]scale=540:960,crop=540:${h}:0:${y}[a];[1]scale=540:960,crop=540:${h}:0:${y}[b];[a][b]ssim`, "-f", "null", "-",
      ]);
      return Number(stderr.match(/All:([\d.]+)/)?.[1] ?? 0);
    };
    return ((await ssim("0", "365")) + (await ssim("826", "134"))) / 2;
  };
  const scores = await Promise.all(cands.map(score));
  const best = scores[1]! > scores[0]! ? 1 : 0;
  gen.log(`bitmiş yapı adayları: ${scores.map((x) => x.toFixed(3)).join(" / ")} → ${best + 1}`);
  await run("cp", [cands[best]!, out]);
  return out;
}

/**
 * Cesium karesinin altındaki atıf yazılarını ("CESIUM ion", "Görüntüler © Google") kırpar: düzenleme modeli
 * istemde yazı istenmese de onları koruyordu. Kırpılan şerit düzenlemeden sonra W×H'ye kırpmayla telafi edilir.
 */
export async function stripAttribution(image: string, out: string) {
  await run("ffmpeg", ["-v", "error", "-y", "-i", image, "-vf", "crop=iw:ih*0.955:0:0", "-frames:v", "1", "-update", "1", out]);
  return out;
}

// ——— Prompt'lar ———

export const ENHANCE_PROMPT =
  "Turn this blurry 3D map render into a sharp, photorealistic aerial drone photograph taken from the same position. " +
  "Keep the exact same camera angle, composition and horizon. Keep every road, dirt track, tree position, the forest, the houses in the background and the hills exactly where they are. " +
  "Keep every tree on the plot: the same number of trees at the same positions and sizes. " +
  "Keep the same season and colors as the render: green patches of grass stay green and dry grass stays golden; do not make the land drier, browner or more yellow. " +
  "The empty plot of land in the foreground stays empty land. Add realistic detail: individual grass, soil texture, tree foliage with natural shadows, clear house roofs. " +
  "Bright natural daylight, clear blue sky, high detail, 4K drone photo. No text, no watermark, no logo.";

export function endPrompt(type: BuildingType, floors: number) {
  const spec = buildingSpec(type, floors);
  const tall = type === "konut" || type === "ticari";
  return (
    `Build ${spec.edit} in the middle of the empty plot in the foreground. ` +
    "The building and its grounds stay inside the plot, between the dirt roads, with open land around them: its footprint covers only about a third of the plot " +
    "and the whole building, its garden and its parking are fully visible in the frame. " +
    (tall
      ? `It is a low-rise building with exactly ${floors} floors: ${floors} rows of windows from the ground to the flat roof, no more. ` +
        `It is only about ${floors * 3} meters tall, roughly ${Math.max(2, Math.round(floors / 1.5))} times the height of the trees around it, and wider than it is tall. `
      : "") +
    "The site is finished and clean: no construction equipment, no bare soil, neat lawns, young trees, paved paths and a small parking area around the building. " +
    "Keep the existing trees on the plot that are not where the building and its grounds stand, and keep both dirt roads exactly as they are. " +
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

const FIRST_STAGE =
  "excavators, bulldozers and dump trucks clear the land and dig the foundation pit, a tower crane is erected, steel rebar is laid and the concrete foundation is poured";
const STAGES = [
  "the first reinforced concrete columns and slabs rise from the foundation, with rebar and formwork",
  "the concrete frame rises floor by floor with scaffolding and the tower crane lifting materials",
  "the frame reaches its full height, brick walls are built and window openings appear",
  "the facade, windows and balconies are completed and the scaffolding is taken down",
  "the crane and machines leave, the soil is levelled, lawns, trees, paths and parking are laid out",
];

/** Boş arsa → kazı klibi. Bina tarifi yok: tarif verilince model önce binayı dikip sonra çukura çeviriyordu. */
const digPrompt = () =>
  `Construction time-lapse of an empty field turning into an excavation site: ${FIRST_STAGE}. No building above the ground. ` +
  "Workers and trucks move steadily, sunlight and shadows shift slowly. " + CAMERA;

/** Kazı → bitmiş yapı klibi: aşamalar sırayla ve zamana eşit yayılarak (her biri yaklaşık bir dilim). */
const buildPrompt = (building: string, seconds: number) =>
  `Construction time-lapse of ${building}, evenly paced over ${seconds} seconds: first ${STAGES.join(", then ")}. ` +
  "Each stage takes a similar share of the time; the building is not finished before the last seconds. " +
  "Workers and trucks move steadily, sunlight and shadows shift slowly. " + CAMERA;

/** Klipleri uç uca ekler: her klibin ilk karesi bir öncekinin son karesiyle aynı, tekrar etmesin diye atlanır. */
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
 * end verilirse (ör. CLI'de aday seçilen bitmiş yapı karesi) hedef kare üretilmez.
 */
export async function buildConstruction(o: {
  gen: Gen;
  /** Netleştirilmiş yan kare (boş arsa). */
  start: string;
  type: BuildingType;
  floors: number;
  /** Dilim sayısı: ilk dilim kazı, kalanlar yapı (4 × 5 sn = 20 sn). */
  clips: number;
  seed: number;
  name: (x: string) => string;
  end?: string;
  onStage?: (stage: "build" | "timelapse" | "compose", progress?: number) => Promise<void> | void;
}): Promise<string> {
  const { gen, start, name } = o;
  const spec = buildingSpec(o.type, o.floors);

  await o.onStage?.("build");
  const end = o.end ?? (await pickEnd(gen, start, endPrompt(o.type, o.floors), name("bitis.png"), o.seed));
  const kaziHam = await editImage(gen, end, KAZI_PROMPT, name("kazi-ham.png"), "kazı", o.seed);
  const kazi = name("kazi.png");
  if (!existsSync(kazi)) await compositeSite(start, kaziHam, kazi, W, H, name("kazi-maske.png"));

  // İki klip paralel; uçları ortak kazı karesi.
  await o.onStage?.("timelapse", 0);
  const buildSeconds = (o.clips - 1) * SEGMENT_SECONDS;
  let done = 0;
  const step = async (p: Promise<string>) => {
    const f = await p;
    await o.onStage?.("timelapse", ++done / 2);
    return f;
  };
  const parts = await Promise.all([
    step(clip(gen, start, kazi, digPrompt(), SEGMENT_SECONDS, name("klip-kazi.mp4"), "kazı klibi")),
    step(clip(gen, kazi, end, buildPrompt(spec.edit, buildSeconds), buildSeconds, name("klip-yapi.mp4"), "yapı klibi")),
  ]);
  await o.onStage?.("compose");
  return joinClips(parts, name(`${o.clips * SEGMENT_SECONDS}sn.mp4`));
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
