/**
 * Drone çekimi kaydedici: 3D harita sahnesini kare kare render eder ve 1080x1920 mp4 yazar.
 *
 *   pnpm --filter @arsa/drone-studio record -- --kml assets/parcels/ornek.kml [--seconds 7] [--fps 30] [--preview]
 *
 * Gerçek zamanlı ekran kaydı yerine her karede kamerayı konumlar ve harita karoları tamamen yüklenene
 * kadar bekler; böylece hiçbir karede bulanık/yüklenmemiş bölge kalmaz.
 *
 * Çıktılar (assets/parcels/<kml adı>/):
 *   drone.mp4            — neon parsel çizgili, alan etiketli drone çekimi
 *   keyframe-neon.png    — son kare (çizgili) → inşaat sahnesinin başlangıcı
 *   keyframe-clean.png   — son kare (çizgisiz)
 *   parcel.json          — parsel geometrisi, alan, rakım
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    kml: { type: "string" },
    seconds: { type: "string", default: "7" },
    fps: { type: "string", default: "30" },
    preview: { type: "boolean", default: false },
    headed: { type: "boolean", default: false },
  },
});
if (!args.kml) throw new Error("--kml assets/parcels/<dosya>.kml gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(import.meta.dirname, "..");
const fps = args.preview ? 10 : Number(args.fps);
const totalFrames = Math.round(Number(args.seconds) * fps);
const outDir = join(ROOT, "assets/parcels", basename(args.kml, ".kml"));
await mkdir(outDir, { recursive: true });

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // easeInOutCubic
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

interface Parcel {
  centroid: { lat: number; lng: number };
  radiusM: number;
  longestEdgeHeading: number;
  elevation: number | null;
  areaM2: number;
}

/**
 * Viral "drone" koreografisi:
 *  0–45%  yüksekten tepeden bakışla alçalıp eğik açıya dönme
 *  45–100% parselin etrafında yarım tura yakın yay çizme, hafif yaklaşma
 */
function cameraAt(i: number, p: Parcel) {
  const t = i / Math.max(1, totalFrames - 1);
  const r = Math.max(25, p.radiusM);
  const h0 = (p.longestEdgeHeading + 20) % 360;
  const base = { lat: p.centroid.lat, lng: p.centroid.lng, altitude: p.elevation ?? 0 };
  if (t < 0.45) {
    const k = ease(t / 0.45);
    return { ...base, range: lerp(Math.max(900, r * 30), r * 5.5, k), tilt: lerp(0, 55, k), heading: lerp(h0 - 40, h0, k) };
  }
  const k = ease((t - 0.45) / 0.55);
  return { ...base, range: lerp(r * 5.5, r * 4.2, k), tilt: lerp(55, 62, k), heading: lerp(h0, h0 + 110, k) };
}

const server = await createServer({ root: APP, configFile: join(APP, "vite.config.ts"), logLevel: "warn" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5178/";

const browser = await chromium.launch({
  channel: "chrome", // bilgisayardaki Chrome kullanılır, ayrı tarayıcı indirilmez
  headless: !args.headed,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("[sayfa]", m.text()));
await page.addInitScript(() => ((window as any).__RECORDER__ = true));
await page.goto(url);

console.log("Parsel ve harita yükleniyor...");
const parcel = (await page.evaluate((kml) => (window as any).studio.load(kml), args.kml)) as Parcel;
await page.evaluate(() => (window as any).studio.setChrome(false));
await writeFile(join(outDir, "parcel.json"), JSON.stringify(parcel, null, 2));
console.log(
  `Alan ${Math.round(parcel.areaM2)} m², yarıçap ${parcel.radiusM.toFixed(0)} m, rakım ${parcel.elevation ?? "?"} m — ${totalFrames} kare @ ${fps} fps`,
);

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
  const cam = cameraAt(i, parcel);
  const ok = await page.evaluate((c) => (window as any).studio.setCamera(c, 15000), cam);
  if (!ok) timeouts++;
  const t = i / Math.max(1, totalFrames - 1);
  await page.evaluate((p) => (window as any).studio.setOverlay(p), clamp01((t - 0.35) / 0.15));
  const png = await page.screenshot({ type: "jpeg", quality: 95 });
  ffmpeg.stdin.write(png);
  if (i % fps === 0) process.stdout.write(`\r  kare ${i + 1}/${totalFrames} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
console.log(`\nDrone videosu: ${out}${timeouts ? ` (${timeouts} karede yükleme zaman aşımı)` : ""}`);

// İnşaat sahnesi için son kare: etiketsiz; çizgili ve çizgisiz iki versiyon.
await page.evaluate(() => (window as any).studio.setOverlay(0));
await page.screenshot({ path: join(outDir, "keyframe-neon.png") });
await page.evaluate(() => (window as any).studio.setNeon(false));
await page.screenshot({ path: join(outDir, "keyframe-clean.png") });
console.log(`Anahtar kareler: ${outDir}/keyframe-{neon,clean}.png — toplam ${((Date.now() - t0) / 1000).toFixed(0)} sn`);

await browser.close();
await server.close();
