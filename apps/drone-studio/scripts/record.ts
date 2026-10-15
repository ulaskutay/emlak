/**
 * Yerel drone kaydı (CLI). Aynı render motorunu RunPod worker'ı da kullanır (scripts/render.ts).
 *
 *   pnpm drone -- --parcel assets/parcels/<dosya>.geojson [--parallel 4] [--fps 30] [--cpu] [--from 2.5 --limit 30]
 *
 * Çıktılar (assets/parcels/<dosya adı>/): drone.mp4, keyframe-neon.png, keyframe-clean.png, parcel.json, context.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { loadEnv } from "vite";
import type { ParcelInfo } from "../src/main.js";
import { renderDrone } from "./render.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    kml: { type: "string" }, // eski ad
    fps: { type: "string", default: "30" },
    parallel: { type: "string", default: "6" },
    prewarm: { type: "string", default: "0" }, // saniyede örnek; ölçümde kazanç yok, varsayılan kapalı
    preview: { type: "boolean", default: false }, // 10 fps
    cpu: { type: "boolean", default: false }, // GPU'suz sunucuyu taklit (SwiftShader)
    from: { type: "string", default: "0" },
    limit: { type: "string" },
    port: { type: "string", default: "5178" },
    headed: { type: "boolean", default: false },
  },
});
const file = args.parcel ?? args.kml;
if (!file) throw new Error("--parcel assets/parcels/<dosya>.geojson (veya .kml) gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const outDir = join(ROOT, "assets/parcels", basename(file, extname(file)));
await mkdir(outDir, { recursive: true });
const key = loadEnv("production", ROOT, "GOOGLE_MAPS_").GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");

// Yavaş dış sorgular (rakım, adres, çevre) önbellekten; çevre listesi boşsa yeniden sorgulanır.
const cacheFile = join(outDir, "context.json");
const cached = existsSync(cacheFile) ? (JSON.parse(await readFile(cacheFile, "utf8")) as ParcelContext) : null;
console.log("Parsel ve çevre bilgisi hazırlanıyor...");
const parcel = await prepareParcel(await readFile(resolve(ROOT, file), "utf8"), { cached });
if (parcel.pois.length) {
  const { elevation, elevationSource, address, pois } = parcel;
  await writeFile(cacheFile, JSON.stringify({ elevation, elevationSource, address, pois }, null, 2));
}
await writeFile(join(outDir, "parcel.json"), JSON.stringify(parcel, null, 2));
console.log(
  `Alan ${Math.round(parcel.areaM2)} m², yarıçap ${parcel.radiusM.toFixed(0)} m, rakım ${parcel.elevation?.toFixed(0) ?? "?"} m — ` +
    `${parcel.pois.map((x) => `${x.label} ${Math.round(x.distanceM)} m`).join(", ") || "çevre noktası yok"}`,
);

const r = await renderDrone({
  parcel: parcel as unknown as ParcelInfo,
  googleKey: key,
  outDir,
  fps: args.preview ? 10 : Number(args.fps),
  parallel: Number(args.parallel),
  prewarmPerSecond: Number(args.prewarm),
  cpu: args.cpu,
  port: Number(args.port),
  headless: !args.headed,
  fromSec: Number(args.from),
  limitFrames: args.limit ? Number(args.limit) : undefined,
});
console.log(
  `Video: ${r.video}\n` +
    `Süre: toplam ${r.seconds.total.toFixed(0)} sn (ön yükleme ${r.seconds.prewarm.toFixed(0)}, render ${r.seconds.render.toFixed(0)}, ` +
    `kodlama ${r.seconds.encode.toFixed(0)}) · ${r.frames} kare → etkin ${(r.seconds.render / r.frames).toFixed(2)} sn/kare` +
    ` · sayfa başı kare ort. ${r.frameSeconds.avg.toFixed(2)} sn${r.timeouts ? ` · ${r.timeouts} zaman aşımı` : ""}`,
);
