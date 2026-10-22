/**
 * Arsanın yandan yakın çekimi (tek kare, yerel CLI): inşaat videosunun başlangıç karesi. Kamera: side.ts.
 *
 *   pnpm --filter @arsa/drone-studio still -- --parcel assets/parcels/<dosya>.geojson
 *     [--heading 90] [--dist 1.6] [--height <m>] [--grid] [--neon] [--headed]
 *
 * --heading: parselin en uzun kenarına göre bakış yönü (derece). --dist: kamera uzaklığı (parsel yarıçapının katı).
 * --height: kameranın yerden yüksekliği (m; verilmezse uzaklığın ~%30'u). --grid: 4 yön × 2 mesafe aday kare.
 * --neon: aynı açının parsel çizgili hali de yazılır (side-…-neon.png).
 * Çıktı: assets/parcels/<dosya adı>/side-<yön>-<uzaklık>.png
 */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { loadEnv } from "vite";
import type { ParcelInfo } from "../src/types.js";
import { defaultSideShot, renderSideShots } from "./side.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    heading: { type: "string" },
    dist: { type: "string" },
    height: { type: "string" },
    grid: { type: "boolean", default: false },
    neon: { type: "boolean", default: false },
    port: { type: "string", default: "5179" },
    headed: { type: "boolean", default: false },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<dosya>.geojson gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
await mkdir(outDir, { recursive: true });
const key = loadEnv("production", ROOT, "GOOGLE_MAPS_").GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");

const cacheFile = join(outDir, "context.json");
const cached = existsSync(cacheFile) ? (JSON.parse(await readFile(cacheFile, "utf8")) as ParcelContext) : null;
const parcel = (await prepareParcel(await readFile(resolve(ROOT, args.parcel), "utf8"), { cached })) as unknown as ParcelInfo;

const base = defaultSideShot(parcel);
const one = {
  heading: args.heading ? Number(args.heading) : base.heading,
  dist: args.dist ? Number(args.dist) : base.dist,
  height: args.height ? Number(args.height) : base.height,
};
const shots = args.grid ? [0, 90, 180, 270].flatMap((heading) => [1.6, 2.4].map((dist) => ({ ...one, heading, dist }))) : [one];
const out = await renderSideShots({ parcel, googleKey: key, shots, outDir, neon: args.neon, port: Number(args.port), headless: !args.headed });
for (const o of out) console.log([o.clean, o.neon].filter(Boolean).join("  "));
process.exit(0);
