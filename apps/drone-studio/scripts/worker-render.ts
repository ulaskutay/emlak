/**
 * RunPod drone worker'ının çağırdığı render komutu (gpu/drone-worker/handler.py).
 *
 *   tsx scripts/worker-render.ts --in /tmp/job/parcel.geojson --out /tmp/job [--fps 30] [--parallel 6] [--crf 22]
 *
 * Parseli hazırlar (alan, rakım, adres, çevre), drone videosunu render eder ve son satırda sonucu JSON yazar.
 * Google Maps anahtarı GOOGLE_MAPS_API_KEY ortam değişkeninden (RunPod endpoint ortam değişkeni) okunur.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel } from "@arsa/geo";
import type { ParcelInfo } from "../src/main.js";
import { renderDrone } from "./render.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    in: { type: "string" },
    out: { type: "string" },
    fps: { type: "string", default: "30" },
    parallel: { type: "string", default: "6" },
    crf: { type: "string", default: "22" },
    cpu: { type: "boolean", default: false },
    limit: { type: "string" },
    context: { type: "string" }, // önceden hesaplanmış çevre bilgisi (context.json)
  },
});
if (!args.in || !args.out) throw new Error("--in <parsel dosyası> --out <klasör> gerekli");
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY ortam değişkeni yok");

await mkdir(args.out, { recursive: true });
const t0 = Date.now();
const cached = args.context ? JSON.parse(await readFile(args.context, "utf8")) : null;
const parcel = await prepareParcel(await readFile(args.in, "utf8"), { googleKey: process.env.GOOGLE_ELEVATION_API_KEY, cached });
const prepareSeconds = (Date.now() - t0) / 1000;
await writeFile(join(args.out, "parcel.json"), JSON.stringify(parcel));
console.error(`[worker] parsel hazır (${prepareSeconds.toFixed(1)} sn): ${Math.round(parcel.areaM2)} m², ${parcel.pois.length} çevre noktası`);

const r = await renderDrone({
  parcel: parcel as unknown as ParcelInfo,
  googleKey: key,
  outDir: args.out,
  fps: Number(args.fps),
  parallel: Number(args.parallel),
  crf: Number(args.crf),
  cpu: args.cpu,
  limitFrames: args.limit ? Number(args.limit) : undefined,
  log: (m) => console.error(`[worker] ${m}`),
});

// handler.py son satırı JSON olarak okur
console.log(
  JSON.stringify({
    video: r.video,
    keyframeNeon: r.keyframeNeon,
    keyframeClean: r.keyframeClean,
    renderer: r.renderer,
    frames: r.frames,
    timeouts: r.timeouts,
    seconds: { prepare: prepareSeconds, ...r.seconds },
    parcel: {
      areaM2: parcel.areaM2,
      properties: parcel.properties,
      address: parcel.address,
      pois: parcel.pois.map(({ label, name, distanceM }) => ({ label, name, distanceM: Math.round(distanceM) })),
    },
  }),
);
process.exit(0); // açık kalan tarayıcı süreçleri/zamanlayıcılar çıkışı bekletmesin
