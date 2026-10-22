/**
 * RunPod drone worker'ının "yan kare" işi (gpu/drone-worker/handler.py, input.still):
 * parseli hazırlar, yandan yakın tek kare çizer (side.ts) ve son satırda sonucu JSON yazar.
 *
 *   tsx scripts/worker-still.ts --in /tmp/job/parcel.geojson --out /tmp/job [--context ctx.json] [--heading 90 --dist 1.6 --height 50]
 */
import { mkdir, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { prepareParcel } from "@arsa/geo";
import type { ParcelInfo } from "../src/types.js";
import { defaultSideShot, renderSideShots } from "./side.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    in: { type: "string" },
    out: { type: "string" },
    context: { type: "string" },
    heading: { type: "string" },
    dist: { type: "string" },
    height: { type: "string" },
  },
});
if (!args.in || !args.out) throw new Error("--in <parsel dosyası> --out <klasör> gerekli");
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY ortam değişkeni yok");

await mkdir(args.out, { recursive: true });
const t0 = Date.now();
const cached = args.context ? JSON.parse(await readFile(args.context, "utf8")) : null;
const parcel = (await prepareParcel(await readFile(args.in, "utf8"), { googleKey: process.env.GOOGLE_ELEVATION_API_KEY, cached })) as unknown as ParcelInfo;
const base = defaultSideShot(parcel);
const shot = {
  heading: args.heading ? Number(args.heading) : base.heading,
  dist: args.dist ? Number(args.dist) : base.dist,
  height: args.height ? Number(args.height) : base.height,
};
const [r] = await renderSideShots({ parcel, googleKey: key, shots: [shot], outDir: args.out, port: 5178, log: (m) => console.error(`[worker] ${m}`) });

// handler.py son satırı JSON olarak okur
console.log(JSON.stringify({ still: r!.clean, shot, seconds: (Date.now() - t0) / 1000, parcel: { areaM2: parcel.areaM2, properties: parcel.properties } }));
process.exit(0);
