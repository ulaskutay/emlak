/**
 * Arsa inşaat videosu: drone çekiminin son karesine AI ile yapı ekler (Qwen-Image-Edit),
 * boş arsadan bitmiş yapıya inşaat timelapse'i üretir (Wan 2.2 ilk/son kare) ve
 * drone + inşaat + kapanış kartını tek dikey videoda birleştirir.
 *
 *   pnpm construction -- --parcel assets/parcels/<ad> --type konut --floors 4 [--price "4.500.000 TL"] [--phone "..."]
 *   --first-frame: bitiş karesi (Qwen) üretilmez, Wan yalnız ilk kare + prompt'la çalışır (insaat-videosu şablonu).
 *   --segments 2:  (--first-frame ile) iki parça; 2. parça 1. parçanın son karesinden başlar (~10 sn).
 *   --res 720:     Wan 720p üretir (varsayılan 480).
 *   --start <dosya>: başlangıç karesi (klasöre göre; varsayılan keyframe-neon.png), ör. side-net.png (yandan yakın çekim).
 *   --prompt "...":  Wan prompt'unu elle ver (deneme için).
 *
 * Girdi klasörü drone kaydedicinin çıktısıdır: drone.mp4, keyframe-neon.png, parcel.json.
 * Ara çıktılar aynı klasöre yazılır; --skip-existing (varsayılan) ile hazır adımlar tekrar üretilmez.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { RunpodClient } from "@arsa/providers";
import { constructionPrompt, constructionStagePrompts, FORMAT_SPECS } from "@arsa/shared";
import { requireEnv } from "./env.js";

const run = promisify(execFile);
const FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const OUT_FPS = 30;

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    type: { type: "string", default: "konut" },
    floors: { type: "string", default: "4" },
    price: { type: "string" },
    phone: { type: "string" },
    seed: { type: "string", default: "7" },
    "first-frame": { type: "boolean", default: false },
    segments: { type: "string", default: "1" },
    res: { type: "string", default: "480" },
    start: { type: "string", default: "keyframe-neon.png" },
    prompt: { type: "string" },
    name: { type: "string" },
    "skip-existing": { type: "boolean", default: true },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<ad> gerekli (drone kaydedicinin çıktı klasörü)");

const ROOT = resolve(import.meta.dirname, "../../..");
const dir = resolve(ROOT, args.parcel);
const parcel = JSON.parse(await readFile(join(dir, "parcel.json"), "utf8")) as { areaM2: number; properties: Record<string, string> };
const floors = Number(args.floors);
const { width: W, height: H } = FORMAT_SPECS.reels_9x16;

/** Yapı tipine göre Qwen düzenleme talimatı ve Wan inşaat tarifi. */
const BUILDINGS: Record<string, { edit: string; label: string }> = {
  konut: {
    label: `${floors} Katlı Konut Projesi`,
    edit: `a modern ${floors}-storey residential apartment building with white and light grey facade, large windows, glass balconies and a flat roof, with landscaped garden and parking around it`,
  },
  villa: {
    label: "Villa Projesi",
    edit: `a luxury modern two-storey villa with a flat roof, large glass windows, a swimming pool and a landscaped garden`,
  },
  // Büyük arsalar (ör. 5.000 m² üzeri zeytinlik/tarla) için tek villa yerine site
  villa_sitesi: {
    label: "Villa Sitesi Projesi",
    edit: `a luxury gated community of modern two-storey villas with flat roofs, private swimming pools, landscaped gardens, olive trees and internal roads`,
  },
  ticari: {
    label: `${floors} Katlı Ticari Proje`,
    edit: `a modern ${floors}-storey commercial office building with a glass curtain wall facade, ground floor shops and a parking area`,
  },
};
const building = BUILDINGS[args.type!];
if (!building) throw new Error(`--type ${Object.keys(BUILDINGS).join(" | ")} olmalı`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runJob(client: RunpodClient, input: unknown, label: string) {
  const t0 = Date.now();
  const job = await client.run(input);
  console.log(`[${label}] gönderildi: ${job.id}`);
  for (;;) {
    await sleep(3000);
    const s = await client.status(job.id);
    if (s.status === "COMPLETED") {
      console.log(`[${label}] tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn (gpu ${s.output?.timings?.generate_seconds} sn)`);
      return s.output as Record<string, any>;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) {
      throw new Error(`[${label}] ${s.status}: ${s.error ?? s.output?.error ?? ""}`);
    }
  }
}

const dataUrl = async (path: string) => `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
const apiKey = requireEnv("RUNPOD_API_KEY");
const start = join(dir, args.start!);
const firstFrame = args["first-frame"];
const segments = Number(args.segments);
if (segments !== 1 && !(segments === 2 && firstFrame)) throw new Error("--segments 2 yalnız --first-frame ile");
/** Wan üretim boyutu (dikey, 16'nın katı). */
const WAN_SIZE: Record<string, [number, number]> = { "480": [480, 832], "720": [720, 1280] };
const wanSize = WAN_SIZE[args.res!];
if (!wanSize) throw new Error("--res 480 | 720 olmalı");
const mode = (args.name ? `-${args.name}` : "") + (firstFrame ? "-ilkkare" : "") + (segments > 1 ? `-${segments}parca` : "") + (args.res !== "480" ? `-${args.res}p` : "");
const end = join(dir, `build-end-${args.type}.png`);
const clip = join(dir, `construction-${args.type}${mode}.mp4`);

// 1) Bitiş karesi: drone karesine parselin içine yapı ekle
if (!firstFrame && !(args["skip-existing"] && existsSync(end))) {
  const qwen = new RunpodClient(apiKey, requireEnv("RUNPOD_QWEN_ENDPOINT_ID"));
  const out = await runJob(
    qwen,
    {
      image_url: await dataUrl(start),
      width: W,
      height: H,
      prompt:
        `Add ${building.edit}, built exactly inside the glowing cyan outlined plot. ` +
        "The building sits on the ground within the outline and matches the aerial camera perspective, scale, shadows and sunlight of the photo. " +
        "Keep the glowing cyan outline visible. Keep everything outside the outline exactly unchanged: roads, trees, neighboring buildings. Photorealistic aerial drone photo.",
      seed: Number(args.seed),
    },
    "qwen bitiş karesi",
  );
  await writeFile(end, Buffer.from(out.image_base64, "base64"));
}

// 2) İnşaat timelapse'i: boş arsa → bitmiş yapı (Wan 2.2 ilk/son kare ya da yalnız ilk kare).
// Parçalı üretimde her parça bir öncekinin son karesinden başlar, sonra uç uca eklenir.
if (!(args["skip-existing"] && existsSync(clip))) {
  const wan = new RunpodClient(apiKey, requireEnv("RUNPOD_WAN_ENDPOINT_ID"));
  const prompts = args.prompt ? [args.prompt] : segments > 1 ? constructionStagePrompts(building.edit) : [constructionPrompt(building.edit, firstFrame)];
  const parts: string[] = [];
  let first = start;
  for (const [i, prompt] of prompts.entries()) {
    const out = await runJob(
      wan,
      {
        image_url: await dataUrl(first),
        ...(!firstFrame && { last_image_url: await dataUrl(end) }),
        width: wanSize[0],
        height: wanSize[1],
        num_frames: 81, // Wan 16 fps → ~5 sn
        frame_rate: 16,
        num_steps: 4,
        output_width: W,
        output_height: H,
        seed: Number(args.seed),
        prompt,
      },
      prompts.length > 1 ? `wan inşaat ${i + 1}/${prompts.length}` : "wan inşaat",
    );
    const part = prompts.length > 1 ? join(dir, `construction-${args.type}${mode}-p${i + 1}.mp4`) : clip;
    await writeFile(part, Buffer.from(out.video_base64, "base64"));
    parts.push(part);
    if (i < prompts.length - 1) {
      first = join(dir, `construction-${args.type}${mode}-p${i + 1}-son.png`);
      await run("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.1", "-i", part, "-frames:v", "1", "-update", "1", first]);
    }
  }
  if (parts.length > 1) {
    // 2. parçanın ilk karesi 1. parçanın son karesiyle aynı: tekrar etmesin diye atlanır.
    const inputs = parts.flatMap((p) => ["-i", p]);
    const chain = parts.map((_, i) => `[${i}:v]${i > 0 ? "trim=start_frame=1,setpts=PTS-STARTPTS," : ""}setsar=1[s${i}]`).join(";");
    await run("ffmpeg", [
      "-v", "error", "-y", ...inputs,
      "-filter_complex", `${chain};${parts.map((_, i) => `[s${i}]`).join("")}concat=n=${parts.length}:v=1:a=0[out]`,
      "-map", "[out]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", clip,
    ]);
  }
}

// 3) Birleştirme: drone + inşaat (yazılı) + kapanış kartı
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");
const area = `${Math.round(parcel.areaM2).toLocaleString("tr-TR")} m²`;
const outro = [args.price ?? area, building.label, args.phone].filter(Boolean) as string[];
const titleSize = Math.round(W * 0.075);
const subSize = Math.round(W * 0.045);
const text = (t: string, size: number, y: string, color = "white", delay = 0) =>
  `drawtext=fontfile='${FONT}':text='${esc(t)}':fontsize=${size}:fontcolor=${color}:borderw=5:bordercolor=black@0.85:` +
  `x=(w-text_w)/2:y=${y}:alpha='min(1,max(0,(t-${delay})*3))'`;

const filters = [
  `[0:v]scale=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p[v0]`,
  `[1:v]scale=${W}:${H},setsar=1,fps=${OUT_FPS},format=yuv420p,` +
    `${text(building.label, titleSize, "h*0.10", "white", 0.3)},` +
    `${text("Temsili görseldir", Math.round(subSize * 0.7), "h*0.93", "white@0.8")}[v1]`,
  `color=c=0x111111:s=${W}x${H}:r=${OUT_FPS}:d=3,format=yuv420p,` +
    outro.map((l, i) => text(l, i === 0 ? titleSize : subSize, `h/2-${outro.length * 60}+${i * 120}`, i === 0 ? "0xFFD54A" : "white", i * 0.2)).join(",") +
    "[v2]",
  "[v0][v1][v2]concat=n=3:v=1:a=0[out]",
];
const final = join(dir, `arsa-${args.type}${mode}-reels.mp4`);
await run("ffmpeg", [
  "-v", "error", "-y", "-i", join(dir, "drone.mp4"), "-i", clip,
  "-filter_complex", filters.join(";"), "-map", "[out]",
  "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", final,
]);
console.log(`Video hazır: ${final}`);
