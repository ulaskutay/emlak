/**
 * Drone çekimi kaydedici: 3D harita sahnesini kare kare render eder ve 1080x1920 mp4 yazar.
 *
 *   pnpm drone -- --parcel assets/parcels/<dosya>.geojson [--fps 30] [--preview]
 *
 * Gerçek zamanlı ekran kaydı yerine her karede sahneyi kurar ve harita karoları tamamen yüklenene
 * kadar bekler; böylece hiçbir karede bulanık/yüklenmemiş bölge kalmaz.
 *
 * Kurgu (~13 sn):
 *   0.0–3.2  Tanıtım: geniş açı, parsel neon çizilir, parselden çevre noktalarına çizgiler, mesafe etiketleri
 *   3.2–6.5  Dalış: kamera parsele alçalır, çevre çizgileri söner
 *   6.5–10.5 Tur: parselin etrafında yay; m² sayacı ve konum
 *   10.5–13  Final: yavaşlayıp sabitlenir (inşaat sahnesinin başlangıç karesi)
 *
 * Çıktılar (assets/parcels/<dosya adı>/): drone.mp4, keyframe-neon.png, keyframe-clean.png, parcel.json
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import type { FrameState, ParcelInfo } from "../src/main.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    kml: { type: "string" }, // eski ad
    fps: { type: "string", default: "30" },
    preview: { type: "boolean", default: false },
    headed: { type: "boolean", default: false },
  },
});
const file = args.parcel ?? args.kml;
if (!file) throw new Error("--parcel assets/parcels/<dosya>.geojson (veya .kml) gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(import.meta.dirname, "..");
const fps = args.preview ? 10 : Number(args.fps);
const DURATION = 13;
const totalFrames = Math.round(DURATION * fps);
const outDir = join(ROOT, "assets/parcels", basename(file, extname(file)));
await mkdir(outDir, { recursive: true });

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** t'nin [a, b] aralığındaki ilerlemesi (0..1). */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/**
 * Anahtar karelerden geçen pürüzsüz kamera yolu (Catmull-Rom). Mesafe (range) logaritmik
 * uzayda yorumlanır: geniş açıdan yakına dalışta hız algısı doğal kalır.
 */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
type Key = { t: number; range: number; tilt: number; heading: number };
function cameraPath(keys: Key[], t: number) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k.t && t <= keys[j + 1]!.t);
  if (i < 0) i = t < keys[0]!.t ? 0 : keys.length - 2;
  const k0 = keys[Math.max(0, i - 1)]!;
  const k1 = keys[i]!;
  const k2 = keys[i + 1]!;
  const k3 = keys[Math.min(keys.length - 1, i + 2)]!;
  const u = span(t, k1.t, k2.t);
  const pick = (f: (k: Key) => number) => catmull(f(k0), f(k1), f(k2), f(k3), u);
  return { range: Math.exp(pick((k) => Math.log(k.range))), tilt: pick((k) => k.tilt), heading: pick((k) => k.heading) };
}

function frameState(i: number, p: ParcelInfo): FrameState {
  const t = (i / Math.max(1, totalFrames - 1)) * DURATION;
  const r = Math.max(25, p.radiusM);
  // Geniş açı yalnızca haritada çizgiyle gösterilen (≤6 km) noktaları kadraja almalı.
  const maxPoi = Math.max(0, ...p.pois.map((x) => x.distanceM).filter((d) => d <= 6000));
  // Tanıtım açısı tüm çevre noktalarını kadraja alacak kadar geniş (dikey kadrajda yatay görüş dar).
  const wide = Math.min(7000, Math.max(r * 25, maxPoi * 2.8, 1200));
  const h0 = (p.longestEdgeHeading + 25) % 360;

  const keys: Key[] = [
    { t: 0, range: wide * 1.15, tilt: 28, heading: h0 - 75 },
    { t: 3.2, range: wide, tilt: 38, heading: h0 - 45 },
    { t: 6.5, range: r * 7.5, tilt: 52, heading: h0 - 5 },
    { t: 10.5, range: r * 6.2, tilt: 56, heading: h0 + 95 },
    { t: 13, range: r * 6.0, tilt: 57, heading: h0 + 110 },
  ];

  return {
    camera: { lat: p.centroid.lat, lng: p.centroid.lng, altitude: p.elevation ?? 0, ...cameraPath(keys, t) },
    neon: span(t, 0.2, 1.4),
    fill: span(t, 0.8, 1.8),
    poiLines: t < 4.6 ? span(t, 1.1, 2.4) : 0,
    // Etiketler sırayla girer, dalışın sonunda birlikte çıkar.
    pills: p.pois.map((_, k) => (t < 5.6 ? span(t, 1.4 + k * 0.32, 1.9 + k * 0.32) : 1 - span(t, 5.6, 6.2))),
    title: span(t, 6.2, 6.8),
    counter: span(t, 6.3, 8.0),
    location: span(t, 7.2, 7.8),
  };
}

const server = await createServer({ root: APP, configFile: join(APP, "vite.config.ts"), logLevel: "warn" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5178/";

const browser = await chromium.launch({
  channel: "chrome", // bilgisayardaki Chrome kullanılır, ayrı tarayıcı indirilmez
  headless: !args.headed,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error("[sayfa]", m.text()));
  await page.addInitScript(() => ((window as any).__RECORDER__ = true));
  await page.goto(url);

  console.log("Parsel, çevre bilgisi ve harita yükleniyor...");
  const parcel = (await page.evaluate((f) => (window as any).studio.load(f), file)) as ParcelInfo;
  await page.evaluate(() => (window as any).studio.setChrome(false));
  await writeFile(join(outDir, "parcel.json"), JSON.stringify(parcel, null, 2));
  console.log(
    `Alan ${Math.round(parcel.areaM2)} m², yarıçap ${parcel.radiusM.toFixed(0)} m, rakım ${parcel.elevation?.toFixed(0) ?? "?"} m — ` +
      `${parcel.pois.length} çevre noktası: ${parcel.pois.map((x) => `${x.label} ${Math.round(x.distanceM)} m`).join(", ")}`,
  );
  console.log(`${totalFrames} kare @ ${fps} fps`);

  const out = join(outDir, args.preview ? "drone-preview.mp4" : "drone.mp4");
  const ffmpeg = spawn(
    "ffmpeg",
    ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
     "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  const t0 = Date.now();
  let timeouts = 0;
  for (let i = 0; i < totalFrames; i++) {
    const ok = await page.evaluate((s) => (window as any).studio.render(s, 15000), frameState(i, parcel));
    if (!ok) timeouts++;
    ffmpeg.stdin.write(await page.screenshot({ type: "jpeg", quality: 95 }));
    if (i % fps === 0) process.stdout.write(`\r  kare ${i + 1}/${totalFrames} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  }
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
  console.log(`\nDrone videosu: ${out}${timeouts ? ` (${timeouts} karede yükleme zaman aşımı)` : ""}`);

  // İnşaat sahnesi için son kare: yazısız; neon çizgili ve çizgisiz iki versiyon.
  await page.evaluate(() => (window as any).studio.clean(true));
  await page.screenshot({ path: join(outDir, "keyframe-neon.png") });
  await page.evaluate(() => (window as any).studio.clean(false));
  await page.screenshot({ path: join(outDir, "keyframe-clean.png") });
  console.log(`Anahtar kareler: ${outDir}/keyframe-{neon,clean}.png — toplam ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
} finally {
  await browser.close();
  await server.close();
}
