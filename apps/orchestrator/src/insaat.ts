/**
 * 30 sn'lik inşaat videosu: arsanın yandan yakın çekiminden bitmiş yapıya.
 *
 *   pnpm insaat -- --parcel assets/parcels/<ad> [--start side-net.png] [--type konut] [--floors 4] [--clips 6] [--res 720]
 *     --candidates 4      hedef kare için farklı seed'lerle Qwen adayları üretip durur (insaat-…-aday-s<seed>.png)
 *     --pick <seed>       seçilen adayla videoyu üretir
 *
 * Kabadan inceye:
 *   1) Qwen: başlangıç karesine bitmiş yapı eklenir (hedef kare; kat sayısı ve peyzaj burada sabitlenir).
 *      Qwen kat sayısını her seed'de tutturamıyor; adaylardan doğru olanı seçilir.
 *   2) Kaba klip: Wan ilk/son kare, boş arsa → bitmiş yapı (~5 sn, bütün aşamalar hızlıca).
 *   3) Ara kareler: kaba klipte toplam görüntü değişimi N eşit parçaya bölünür (Wan binayı erken kurduğu için
 *      zamanda eşit aralık videonun ikinci yarısını durağan bırakıyordu).
 *   4) İnce klipler: ardışık iki ara kare arasında Wan ilk/son kare (paralel), uç uca → --clips × ~5 sn.
 * Her klibin başı ve sonu sabit olduğundan zincirde kayma birikmez (yalnız ilk kareden zincirde bina bozuluyordu).
 * Wan klipleri ham (büyütmesiz) üretilir, büyütme en sonda bir kez: her klibi büyütüp tekrar Wan'a vermek
 * keskinleştirmeyi katlıyor, görüntü yağlı boyaya dönüyordu.
 * Ara çıktılar parsel klasörüne insaat-* adıyla yazılır; var olan adımlar tekrar üretilmez.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { RunpodClient } from "@arsa/providers";
import { buildingSpec, BuildingType, FORMAT_SPECS } from "@arsa/shared";
import { requireEnv } from "./env.js";

const run = promisify(execFile);

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    start: { type: "string", default: "side-net.png" },
    type: { type: "string", default: "konut" },
    floors: { type: "string", default: "4" },
    clips: { type: "string", default: "6" },
    res: { type: "string", default: "720" },
    seed: { type: "string", default: "7" },
    candidates: { type: "string" },
    pick: { type: "string" },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<ad> gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const dir = resolve(ROOT, args.parcel);
const type = BuildingType.parse(args.type);
const floors = Number(args.floors);
const spec = buildingSpec(type, floors);
const N = Number(args.clips);
const seed = Number(args.pick ?? args.seed);
const { width: W, height: H } = FORMAT_SPECS.reels_9x16;
const WAN_SIZE: Record<string, [number, number]> = { "480": [480, 832], "720": [720, 1280] };
const wanSize = WAN_SIZE[args.res!]!;
if (!WAN_SIZE[args.res!]) throw new Error("--res 480 | 720 olmalı");
/** Wan klibi: 81 kare @ 16 fps ≈ 5 sn. */
const FRAMES = 81;
const FPS = 16;

const apiKey = requireEnv("RUNPOD_API_KEY");
const qwen = new RunpodClient(apiKey, requireEnv("RUNPOD_QWEN_ENDPOINT_ID"));
const wan = new RunpodClient(apiKey, requireEnv("RUNPOD_WAN_ENDPOINT_ID"));
const base = (name: string) => join(dir, `insaat-${type}-${floors}k-${name}`);
const f = (name: string) => base(`s${seed}-${name}`);
const dataUrl = async (path: string) => `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
const t0 = Date.now();

async function runJob(client: RunpodClient, input: unknown, label: string) {
  const ts = Date.now();
  const job = await client.run(input);
  console.log(`[${label}] gönderildi: ${job.id}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await client.status(job.id);
    if (s.status === "COMPLETED") {
      const out = s.output as Record<string, any>;
      console.log(`[${label}] tamam: ${((Date.now() - ts) / 1000).toFixed(0)} sn (gpu ${out.timings?.generate_seconds} sn)`);
      return out;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) throw new Error(`[${label}] ${s.status}: ${s.error ?? s.output?.error ?? ""}`);
  }
}

/** Wan ilk/son kare klibi (yoksa üretir). */
async function wanClip(first: string, last: string, prompt: string, out: string, label: string) {
  if (existsSync(out)) return out;
  const r = await runJob(
    wan,
    {
      image_url: await dataUrl(first),
      last_image_url: await dataUrl(last),
      width: wanSize[0],
      height: wanSize[1],
      num_frames: FRAMES,
      frame_rate: FPS,
      num_steps: 4,
      seed,
      prompt,
    },
    label,
  );
  await writeFile(out, Buffer.from(r.video_base64, "base64"));
  return out;
}

const CAMERA =
  "Fixed drone camera, no camera movement. The dirt roads, olive trees outside the plot, the forest, the village and the hills in the background stay exactly unchanged. " +
  "Photorealistic, sharp, high detail.";

// 1) Hedef kare: bitmiş yapı. Kat sayısı sayıyla tutmuyor; çevreye göre boyla da tarif edilir.
const start = join(dir, args.start!);
const tall = type === "konut" || type === "ticari";
const qwenPrompt =
  `Build ${spec.edit} in the middle of the empty grassland plot in the foreground. ` +
  (tall
    ? `It is a low-rise building with exactly ${floors} floors: ${floors} rows of windows from the ground to the flat roof, no more. ` +
      `It is only about ${floors * 3} meters tall, roughly ${Math.max(2, Math.round(floors / 1.5))} times the height of the olive trees around it, and wider than it is tall. `
    : "") +
  "The site is finished and clean: no construction equipment, no bare soil, neat lawns, young trees, paved paths and a small parking area around the building. " +
  "It sits naturally on the ground and matches the drone camera perspective, scale, shadows and sunlight of the photo. " +
  "Keep the camera angle, the dirt roads, the forest, the village and the hills in the background exactly unchanged, with the same natural colors and softness as the photo. " +
  "Photorealistic aerial drone photo.";
const qwenEnd = async (s: number, out: string) => {
  const r = await runJob(
    qwen,
    // true_cfg_scale 4 → 3: daha düşük CFG'de aşırı doygunluk ve keskinlik azalıyor.
    { image_url: await dataUrl(start), width: W, height: H, seed: s, true_cfg_scale: 3, prompt: qwenPrompt },
    `qwen s${s}`,
  );
  await writeFile(out, Buffer.from(r.image_base64, "base64"));
};
if (args.candidates) {
  const seeds = Array.from({ length: Number(args.candidates) }, (_, i) => seed + i);
  await Promise.all(seeds.map((s) => (existsSync(base(`aday-s${s}.png`)) ? null : qwenEnd(s, base(`aday-s${s}.png`)))));
  console.log(`Adaylar hazır: ${seeds.map((s) => base(`aday-s${s}.png`)).join(", ")}\nSeçip --pick <seed> ile çalıştırın.`);
  process.exit(0);
}
const end = f("bitis.png");
if (!existsSync(end)) {
  const cand = base(`aday-s${seed}.png`);
  if (existsSync(cand)) await run("cp", [cand, end]);
  else await qwenEnd(seed, end);
}

// 2) Kaba klip: bütün inşaat hızlıca
const coarse = await wanClip(
  start,
  end,
  "Fast construction time-lapse. On the empty plot, excavators dig the foundation and a tower crane is erected, " +
    "a reinforced concrete frame rises floor by floor with scaffolding, the walls, windows and facade are completed, the crane and scaffolding are removed " +
    `and the site is landscaped, revealing ${spec.edit}. Workers and trucks move quickly. ` + CAMERA,
  f("kaba.mp4"),
  "wan kaba",
);

// 3) Ara kareler: kaba klipte kare farklarının toplamı N eşit parçaya bölünür; her ince klip benzer miktarda değişim taşır.
async function changeAnchors(video: string, n: number): Promise<number[]> {
  const w = 72, h = 128;
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
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
const picks = await changeAnchors(coarse, N);
console.log(`ara kareler (kaba klipte kare no): ${picks.join(", ")}`);
const anchors = [start];
for (const [k, n] of picks.entries()) {
  const path = f(`ara-${k + 1}.png`);
  if (!existsSync(path)) await run("ffmpeg", ["-v", "error", "-y", "-i", coarse, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", "-update", "1", path]);
  anchors.push(path);
}
anchors.push(end);

// 4) İnce klipler: her biri inşaatın bir dilimi; prompt hareketi tarif eder, başı/sonu ara karelerle sabit.
const STAGES = [
  "excavators, bulldozers and dump trucks clear the land and dig the foundation pit, a tower crane is erected",
  "concrete foundations are poured and the first reinforced concrete columns and slabs rise, with rebar and formwork",
  "the concrete frame rises floor by floor with scaffolding and the tower crane lifting materials",
  "the frame reaches its full height, brick walls are built and window openings appear",
  "the facade, windows and balconies are completed and the scaffolding is taken down",
  "the crane and machines leave, the soil is levelled, lawns, trees, paths and parking are laid out",
];
const stageFor = (i: number) => STAGES[Math.min(STAGES.length - 1, Math.floor((i * STAGES.length) / N))]!;
const parts = await Promise.all(
  Array.from({ length: N }, (_, i) =>
    wanClip(
      anchors[i]!,
      anchors[i + 1]!,
      `Construction time-lapse of ${spec.edit}: ${stageFor(i)}. Workers and trucks move steadily, sunlight and shadows shift slowly. ` + CAMERA,
      f(`klip-${i + 1}.mp4`),
      `wan ${i + 1}/${N}`,
    ),
  ),
);

// 5) Birleştirme: her klibin ilk karesi bir öncekinin son karesiyle aynı, tekrar etmesin diye atlanır.
const final = f(`${N * 5}sn.mp4`);
const chain = parts.map((_, i) => `[${i}:v]${i > 0 ? "trim=start_frame=1,setpts=PTS-STARTPTS," : ""}setsar=1[s${i}]`).join(";");
await run("ffmpeg", [
  "-v", "error", "-y", ...parts.flatMap((p) => ["-i", p]),
  "-filter_complex", `${chain};${parts.map((_, i) => `[s${i}]`).join("")}concat=n=${parts.length}:v=1:a=0,fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p[out]`,
  "-map", "[out]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", final,
]);
console.log(`Video hazır: ${final} (toplam ${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
