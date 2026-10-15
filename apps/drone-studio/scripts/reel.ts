/**
 * Arsa Reels CLI: üretim hattını (scripts/pipeline.ts) bir parsel dosyası için çalıştırır.
 *
 *   pnpm reel -- --parcel assets/parcels/<dosya>.geojson [--voice <id>] [--runpod] [--no-voice] [--no-music]
 *                [--price 12500000 --office "Etic Emlak" --phone "0532 000 00 00" --zoning "Konut imarlı"]
 *
 * Çıktı: assets/parcels/<ad>/reel/reel.mp4 (ara dosyalar ve ses önbelleği aynı klasörde)
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ParcelContext } from "@arsa/geo";
import { produceReel } from "./pipeline.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    runpod: { type: "boolean", default: false },
    "no-voice": { type: "boolean", default: false },
    "no-music": { type: "boolean", default: false },
    "skip-render": { type: "boolean", default: false }, // yalnızca ses/miks (mevcut reel/drone.mp4 ile)
    parallel: { type: "string", default: "8" },
    voice: { type: "string" }, // ElevenLabs ses kimliği (pnpm voices ile listelenir)
    price: { type: "string" },
    office: { type: "string" },
    phone: { type: "string" },
    zoning: { type: "string" },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<dosya>.geojson gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
const contextFile = join(outDir, "context.json");
const t0 = Date.now();

const r = await produceReel({
  parcelText: await readFile(resolve(ROOT, args.parcel), "utf8"),
  context: existsSync(contextFile) ? (JSON.parse(await readFile(contextFile, "utf8")) as ParcelContext) : null,
  listing: {
    priceTry: args.price ? Number(args.price) : undefined,
    officeName: args.office,
    phone: args.phone,
    zoning: args.zoning,
  },
  voiceId: args.voice,
  voice: !args["no-voice"],
  music: !args["no-music"],
  render: args.runpod ? "runpod" : "local",
  workDir: join(outDir, "reel"),
  outputPrefix: `reels/${basename(outDir)}/${Date.now()}`,
  parallel: Number(args.parallel),
  skipRender: args["skip-render"],
  onStage: (s, p) => (p === 0 ? console.log(`\n[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} sn] ${s}`) : undefined),
});
if (r.context.pois.length && !existsSync(contextFile)) await writeFile(contextFile, JSON.stringify(r.context, null, 2));
console.log(`\nHazır: ${r.reelPath} (${r.durationSec.toFixed(1)} sn) · ${JSON.stringify(r.seconds)}`);
process.exit(0);
