/**
 * Arsanın yandan yakın çekimi (tek kare): inşaat videosunun başlangıç karesi.
 * Kamera alçaktan, parsele yandan bakar; neon/yazı yok, sade fotogerçekçi kare.
 *
 *   pnpm --filter @arsa/drone-studio still -- --parcel assets/parcels/<dosya>.geojson
 *     [--heading 90] [--dist 2.5] [--height 35] [--grid] [--neon] [--headed]
 *
 * --heading: parselin en uzun kenarına göre bakış yönü (derece). --dist: kamera uzaklığı (parsel yarıçapının katı).
 * --height: kameranın yerden yüksekliği (m). --grid: 4 yön × 2 mesafe aday kare üretir, en iyisi seçilsin diye.
 * --neon: aynı açının parsel çizgili hali de yazılır (side-…-neon.png): parselin karedeki yeri, AI düzenlemede maske.
 * Çıktı: assets/parcels/<dosya adı>/side-<yön>-<uzaklık>.png
 */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { chromium } from "playwright-core";
import { createServer, loadEnv } from "vite";
import type { FrameState, ParcelInfo } from "../src/types.js";
import { chromeArgs, pickGlMode, withTimeout } from "./render.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    heading: { type: "string", default: "90" },
    dist: { type: "string", default: "2.5" },
    height: { type: "string", default: "35" },
    grid: { type: "boolean", default: false },
    neon: { type: "boolean", default: false },
    port: { type: "string", default: "5179" },
    headed: { type: "boolean", default: false },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<dosya>.geojson gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(import.meta.dirname, "..");
const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
await mkdir(outDir, { recursive: true });
const key = loadEnv("production", ROOT, "GOOGLE_MAPS_").GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");

const cacheFile = join(outDir, "context.json");
const cached = existsSync(cacheFile) ? (JSON.parse(await readFile(cacheFile, "utf8")) as ParcelContext) : null;
const parcel = (await prepareParcel(await readFile(resolve(ROOT, args.parcel), "utf8"), { cached })) as unknown as ParcelInfo;
const r = Math.max(25, parcel.radiusM);

/** Yandan alçak kamera: yatay uzaklık D, yükseklik H → Cesium range/tilt (tilt = 90 + pitch). */
function sideState(headingOffset: number, distMul: number, heightM: number): FrameState {
  const D = r * distMul;
  return {
    camera: {
      lat: parcel.centroid.lat,
      lng: parcel.centroid.lng,
      altitude: 0,
      range: Math.hypot(D, heightM),
      tilt: 90 - (Math.atan2(heightM, D) * 180) / Math.PI,
      heading: parcel.longestEdgeHeading + headingOffset,
    },
    mode: "SATELLITE",
    neon: 0,
    fill: 0,
    fence: 0,
  };
}

const shots = args.grid
  ? [0, 90, 180, 270].flatMap((h) => [1.8, 2.8].map((d) => ({ h, d })))
  : [{ h: Number(args.heading), d: Number(args.dist) }];

const server = await createServer({
  root: APP,
  configFile: join(APP, "vite.config.ts"),
  logLevel: "warn",
  server: { port: Number(args.port), strictPort: true, watch: null },
});
await server.listen();
const url = server.resolvedUrls?.local[0] ?? `http://localhost:${args.port}/`;
const browser = await chromium.launch({ channel: "chrome", headless: !args.headed, args: chromeArgs(await pickGlMode()) });
try {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
  await page.addInitScript(() => ((window as any).__RECORDER__ = true));
  await withTimeout(page.goto(url), 60000, "sayfa yüklemesi");
  await withTimeout(page.evaluate(([p, k]) => (window as any).studio.loadParcel(p, k), [parcel, key] as const), 150000, "harita yüklemesi");
  await page.evaluate(() => (window as any).studio.setChrome(false));
  for (const { h, d } of shots) {
    await page.evaluate((s) => (window as any).studio.render(s, 30000), sideState(h, d, Number(args.height)));
    await page.evaluate(() => (window as any).studio.clean(false));
    const path = join(outDir, `side-${h}-${d}.png`);
    await page.screenshot({ path });
    console.log(path);
    if (args.neon) {
      await page.evaluate((s) => (window as any).studio.render(s, 30000), { ...sideState(h, d, Number(args.height)), neon: 1, fill: 0.25 });
      await page.evaluate(() => (window as any).studio.clean(true));
      const neonPath = join(outDir, `side-${h}-${d}-neon.png`);
      await page.screenshot({ path: neonPath });
      console.log(neonPath);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
