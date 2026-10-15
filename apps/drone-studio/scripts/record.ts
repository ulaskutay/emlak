/**
 * Drone çekimi kaydedici: 3D harita sahnesini kare kare render eder ve 1080x1920 mp4 yazar.
 *
 *   pnpm drone -- --parcel assets/parcels/<dosya>.geojson [--fps 30] [--preview]
 *
 * Gerçek zamanlı ekran kaydı yerine her karede sahneyi kurar ve harita karoları tamamen yüklenene
 * kadar bekler; böylece hiçbir karede bulanık/yüklenmemiş bölge kalmaz.
 *
 * Kurgu (~20 sn):
 *   Açılış (2,5 sn)   parselin üstü, neon kontur çizilir
 *   Çevre turu        en önemli 3 yer için: parselden yere uçuş (bağlantı çizgisi kamerayla uzar, Google
 *                     yer etiketleri açık), yerin üstünde kısa duruş + büyük kart, parsele dönüş (liste etiketi)
 *   Final (6,5 sn)    parsele dalış, etrafında tur, m² sayacı ve konum; sabitlenen son kare inşaatın başlangıcı
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
const outDir = join(ROOT, "assets/parcels", basename(file, extname(file)));
await mkdir(outDir, { recursive: true });

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** t'nin [a, b] aralığındaki ilerlemesi (0..1). */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** En kısa yönden açı geçişi (359° → 1° arası 2°). */
const lerpAngle = (a: number, b: number, u: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

/** Kamera anahtar karesi. arc: bu kareye giderken kamera yükselip alçalır (iki uç birlikte görünsün). */
type Key = { t: number; lat: number; lng: number; range: number; tilt: number; heading: number; arc?: number };

function cameraAt(keys: Key[], t: number) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t <= keys[j + 1]!.t);
  if (i < 0) i = keys.length - 2;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const u = smooth(span(t, a.t, b.t));
  return {
    lat: lerp(a.lat, b.lat, u),
    lng: lerp(a.lng, b.lng, u),
    // Mesafe logaritmik uzayda: geniş açıdan yakına geçiş doğal; arc ile yolun ortasında yükselme.
    range: Math.exp(lerp(Math.log(a.range), Math.log(b.range), u)) + (b.arc ?? 0) * Math.sin(Math.PI * u),
    tilt: lerp(a.tilt, b.tilt, u),
    heading: lerpAngle(a.heading, b.heading, u),
  };
}

/** Zaman çizelgesi parsel ve çevre bilgisine göre bir kez kurulur. */
function buildTimeline(p: ParcelInfo) {
  const r = Math.max(25, p.radiusM);
  const P = p.centroid;
  const h0 = (p.longestEdgeHeading + 25) % 360;
  const Rp = Math.max(r * 12, 900); // çevre turunda parselin görüldüğü mesafe

  // En önemli 3 yer (öncelik sırası API'den gelir); çok uzaktakiler uçuşu uzatır.
  const tour = p.pois.map((poi, index) => ({ poi, index })).filter(({ poi }) => poi.distanceM <= 20000).slice(0, 3);

  const INTRO = 2.5;
  const OUT = 1.7;
  const HOLD = 0.9;
  const BACK = 1.2;
  const LEG = OUT + HOLD + BACK;
  const tourEnd = INTRO + tour.length * LEG;
  const FINAL = 6.5;
  const duration = tourEnd + FINAL;

  const keys: Key[] = [
    { t: 0, ...P, range: Rp * 1.25, tilt: 30, heading: h0 - 40 },
    { t: INTRO, ...P, range: Rp, tilt: 42, heading: h0 - 20 },
  ];
  let heading = h0 - 20;
  tour.forEach(({ poi }, k) => {
    const T = INTRO + k * LEG;
    const dir = bearing(P, poi.position);
    // Uçuş yönüne bak: hedef ekranın üst tarafında, bağlantı çizgisi ekranda dikey uzanır.
    const Rpoi = Math.min(1600, Math.max(450, poi.distanceM * 0.25));
    const arc = poi.distanceM * 0.9;
    keys.push({ t: T + OUT, ...poi.position, range: Rpoi, tilt: 50, heading: dir, arc });
    keys.push({ t: T + OUT + HOLD, ...poi.position, range: Rpoi * 0.92, tilt: 52, heading: dir + 8 });
    heading = dir + 8;
    keys.push({ t: T + LEG, ...P, range: Rp, tilt: 42, heading, arc });
  });
  keys.push(
    { t: tourEnd + 2.0, ...P, range: r * 7.5, tilt: 52, heading: heading + 20 },
    { t: tourEnd + 5.5, ...P, range: r * 6.2, tilt: 56, heading: heading + 115 },
    { t: duration, ...P, range: r * 6.0, tilt: 57, heading: heading + 130 },
  );

  function frameState(t: number): FrameState {
    const lines = p.pois.map(() => 0);
    const markers = p.pois.map(() => 0);
    const pills = p.pois.map(() => 0);
    let card: FrameState["card"] = null;
    tour.forEach(({ index }, k) => {
      const T = INTRO + k * LEG;
      // Çizgi kameranın merkeziyle aynı eğriyle uzar: ekranda hedefe "çekiliyormuş" gibi görünür.
      lines[index] = t < tourEnd + 1.6 ? smooth(span(t, T, T + OUT)) : 0;
      markers[index] = t >= T + OUT * 0.6 && t < tourEnd + 1.6 ? 1 : 0;
      if (t >= T + OUT - 0.15 && t <= T + OUT + HOLD + 0.3) {
        card = { index, progress: Math.min(span(t, T + OUT - 0.15, T + OUT + 0.25), 1 - span(t, T + OUT + HOLD, T + OUT + HOLD + 0.3)) };
      }
      // Ziyaret edilen yer dönüşte soldaki listeye eklenir; finalde liste çekilir.
      pills[index] = Math.min(span(t, T + OUT + HOLD + 0.1, T + OUT + HOLD + 0.5), 1 - span(t, tourEnd + 1.0, tourEnd + 1.6));
    });
    return {
      camera: { ...cameraAt(keys, t), altitude: p.elevation ?? 0 },
      mode: t > INTRO - 0.3 && t < tourEnd ? "HYBRID" : "SATELLITE",
      neon: span(t, 0.2, 1.4),
      fill: span(t, 0.8, 1.8),
      lines,
      markers,
      pills,
      card,
      title: span(t, tourEnd + 1.4, tourEnd + 2.0),
      counter: span(t, tourEnd + 1.5, tourEnd + 3.2),
      location: span(t, tourEnd + 2.4, tourEnd + 3.0),
    };
  }
  return { duration, frameState, tour };
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
  const timeline = buildTimeline(parcel);
  const totalFrames = Math.round(timeline.duration * fps);
  console.log(
    `Çevre turu: ${timeline.tour.map(({ poi }) => poi.name ?? poi.label).join(" → ") || "(yok)"} — ` +
      `${timeline.duration.toFixed(1)} sn, ${totalFrames} kare @ ${fps} fps`,
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
    const state = timeline.frameState((i / Math.max(1, totalFrames - 1)) * timeline.duration);
    const ok = await page.evaluate((s) => (window as any).studio.render(s, 15000), state);
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
