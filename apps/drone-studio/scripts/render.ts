/**
 * Drone render motoru — hem yerel CLI (record.ts) hem RunPod worker'ı (gpu/drone-worker) kullanır.
 *
 * Her karede sahneyi kurar ve harita karoları tamamen yüklenene kadar bekler (bulanık kare olmaz).
 * Hızlandırma: kareler K sayfaya ardışık parçalar halinde bölünür (aynı tarayıcı bağlamı = ortak önbellek).
 * Ölçüm (Mac M2, Ezine, en ağır bölüm): tek sayfa 1,74 sn/kare; 4 paralel 0,44; 8 paralel 0,34.
 * GPU'suz (SwiftShader) tek sayfa 2,58, 4 paralelde işlemci doyuyor (1,67). Ön yükleme turu kazanç
 * getirmedi (bekleme karo indirmekten çok Google'ın detayı kademeli netleştirmesinden) — varsayılan kapalı.
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer } from "vite";
import type { ParcelInfo } from "../src/types.js";
import type { Story } from "./story.js";
import { buildTimeline } from "./timeline.js";

export interface RenderOptions {
  parcel: ParcelInfo;
  /** Seslendirmeli senaryo: kurgu anlatıma göre uzar, altyazı çizilir. */
  story?: Story;
  googleKey: string;
  outDir: string;
  fps?: number;
  /** Paralel sayfa sayısı. */
  parallel?: number;
  /** Ön yükleme turu (saniyede kaç örnek); 0 kapalı. */
  prewarmPerSecond?: number;
  /** GPU'suz ortam: yazılımsal WebGL (SwiftShader). glMode verilirse o kullanılır. */
  cpu?: boolean;
  glMode?: GlMode;
  /** Her paralel sayfa ayrı tarayıcıda (ayrı GPU süreci). Varsayılan: Linux + GPU'da açık. */
  isolate?: boolean;
  port?: number;
  crf?: number;
  headless?: boolean;
  /** Ölçüm için yalnızca bir aralık. */
  fromSec?: number;
  limitFrames?: number;
  log?: (msg: string) => void;
}

export interface RenderResult {
  video: string;
  keyframeNeon: string;
  keyframeClean: string;
  frames: number;
  renderer: string;
  seconds: { prewarm: number; render: number; encode: number; total: number };
  frameSeconds: { avg: number; p50: number; max: number };
  timeouts: number;
}

const APP = resolve(import.meta.dirname, "..");

export type GlMode = "auto" | "vulkan" | "egl" | "swiftshader";

/** Chrome WebGL arka ucu. auto: macOS'ta Metal; Linux'ta GL_MODE ya da swiftshader (seçimi pickGlMode yapar). */
export function chromeArgs(mode: GlMode): string[] {
  const common = ["--no-sandbox", "--disable-dev-shm-usage"];
  if (mode === "auto" && process.platform === "linux") mode = (process.env.GL_MODE as GlMode) ?? "swiftshader";
  switch (mode) {
    case "swiftshader":
      return [...common, "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
    case "vulkan":
      return [...common, "--ignore-gpu-blocklist", "--use-angle=vulkan", "--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan", "--disable-vulkan-surface", "--enable-gpu"];
    case "egl":
      return [...common, "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=gl-egl", "--enable-gpu"];
    default:
      return ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"];
  }
}

/**
 * Linux'ta (RunPod) gerçek GPU'lu WebGL arka ucunu bulur: vulkan → egl, çizici SwiftShader değilse onu seçer.
 * Bulamazsa swiftshader: GPU'suz egl/vulkan yarım bir yazılım moduna düşüyor ve Google 3D harita
 * orada "Attempted to load a 3D Map, but failed" ile açılmıyor.
 */
export async function pickGlMode(log: (m: string) => void = () => {}): Promise<GlMode> {
  if (process.platform !== "linux") return "auto";
  if (process.env.GL_MODE) return process.env.GL_MODE as GlMode;
  for (const mode of ["vulkan", "egl"] as GlMode[]) {
    const b = await withTimeout(chromium.launch({ channel: "chrome", headless: true, args: chromeArgs(mode) }), 20000, "launch").catch(() => null);
    if (!b) continue;
    try {
      const page = await b.newPage();
      const r = await withTimeout(webglRenderer(page), 10000, "webgl").catch(() => "yok");
      log(`GL denemesi ${mode}: ${r}`);
      if (!/swiftshader|llvmpipe|bilinmiyor|yok/i.test(r)) return mode;
    } finally {
      withTimeout(b.close(), 5000, "kapanış").catch(() => {});
    }
  }
  return "swiftshader";
}

/** Takılan adımlar sonsuza dek beklemesin. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} ${ms / 1000} sn içinde bitmedi`)), ms))]);
}

async function webglRenderer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "bilinmiyor";
  });
}

export async function renderDrone(o: RenderOptions): Promise<RenderResult> {
  const log = o.log ?? ((m: string) => console.log(m));
  const fps = o.fps ?? 30;
  const parallel = Math.max(1, o.parallel ?? 6);
  const t0 = Date.now();
  const timeline = buildTimeline(o.parcel, o.story);
  const total = Math.round(timeline.duration * fps);
  const first = Math.round((o.fromSec ?? 0) * fps);
  const last = o.limitFrames ? Math.min(total, first + o.limitFrames) : total;
  const stateAt = (i: number) => timeline.frameState((i / Math.max(1, total - 1)) * timeline.duration);

  const framesDir = join(o.outDir, ".frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const server = await createServer({
    root: APP,
    configFile: join(APP, "vite.config.ts"),
    logLevel: "warn",
    server: { port: o.port ?? 5178, strictPort: true, watch: null }, // dosya izleme gereksiz (konteynerde takılabilir)
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? `http://localhost:${o.port ?? 5178}/`;
  log(`vite hazır: ${url}`);
  const glMode = o.glMode ?? (o.cpu ? "swiftshader" : await pickGlMode(log));
  log(`WebGL arka ucu: ${glMode}`);
  // Linux GPU'da (Vulkan) her sayfa kendi Chrome'unda: tek GPU sürecini paylaşan 8 sayfada ekran görüntüsü
  // takılıyordu. Mac'te tek tarayıcı/bağlam: sayfalar HTTP önbelleğini (harita karoları) paylaşır.
  const isolate = o.isolate ?? (process.platform === "linux" && glMode !== "swiftshader");
  const launch = () =>
    withTimeout(chromium.launch({ channel: "chrome", headless: o.headless ?? true, args: chromeArgs(glMode) }), 60000, "Chrome açılışı");
  const browsers: Browser[] = [];
  const newContext = async () => {
    const browser = await launch();
    browsers.push(browser);
    const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => ((window as any).__RECORDER__ = true));
    return context;
  };
  const shared = await newContext();
  log(`chrome açıldı (${browsers[0]!.version()})${isolate ? " · her sayfa ayrı tarayıcıda" : ""}`);

  try {
    let pageNo = 0;
    const openPage = async () => {
      const n = ++pageNo;
      const page = await (isolate && n > 1 ? await newContext() : shared).newPage();
      page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && log(`[sayfa ${n}] ${m.text()}`));
      page.on("pageerror", (e) => log(`[sayfa ${n}] hata: ${e.message}`));
      const ts = Date.now();
      await withTimeout(page.goto(url), 60000, `sayfa ${n} yüklemesi`);
      await withTimeout(
        page.evaluate(([p, k]) => (window as any).studio.loadParcel(p, k), [o.parcel, o.googleKey] as const),
        150000,
        `sayfa ${n} harita yüklemesi`,
      );
      await page.evaluate(() => (window as any).studio.setChrome(false));
      log(`sayfa ${n} hazır (${((Date.now() - ts) / 1000).toFixed(1)} sn)`);
      return page;
    };

    const first0 = await openPage();
    const renderer = await webglRenderer(first0);
    log(`WebGL: ${renderer} · ${total} kare @ ${fps} fps · ${parallel} paralel sayfa`);

    // 1) Ön yükleme: seyrek örneklerle yolu gez; karolar önbelleğe iner.
    const tp = Date.now();
    const perSec = o.prewarmPerSecond ?? 0;
    if (perSec > 0) {
      const step = Math.max(1, Math.round(fps / perSec));
      for (let i = first; i < last; i += step) await first0.evaluate((s) => (window as any).studio.render(s, 6000), stateAt(i));
      log(`Ön yükleme: ${((Date.now() - tp) / 1000).toFixed(0)} sn`);
    }
    const prewarmSec = (Date.now() - tp) / 1000;

    // 2) Paralel render: her sayfa ardışık bir kare aralığı (kamera sürekliliği, kendi bölgesinin karoları).
    const pages = [first0, ...(await Promise.all(Array.from({ length: parallel - 1 }, openPage)))];
    const count = last - first;
    const chunk = Math.ceil(count / pages.length);
    const frameTimes: number[] = [];
    let timeouts = 0;
    let done = 0;
    const tr = Date.now();
    await Promise.all(
      pages.map(async (page, k) => {
        const a = first + k * chunk;
        const b = Math.min(last, a + chunk);
        for (let i = a; i < b; i++) {
          const tf = Date.now();
          const path = join(framesDir, `${String(i - first).padStart(5, "0")}.jpg`);
          const ok = await page.evaluate((s) => (window as any).studio.render(s, 15000), stateAt(i));
          if (!ok) timeouts++;
          // Ekran görüntüsü takılırsa kareyi yeniden çizip bir kez daha dene.
          await page.screenshot({ path, type: "jpeg", quality: 95, timeout: 15000 }).catch(async (e) => {
            log(`[sayfa ${k + 1}] kare ${i} ekran görüntüsü tekrar: ${String(e).split("\n")[0]}`);
            await page.evaluate((s) => (window as any).studio.render(s, 15000), stateAt(i));
            await page.screenshot({ path, type: "jpeg", quality: 95, timeout: 30000 });
          });
          frameTimes.push(Date.now() - tf);
          if (++done % fps === 0) log(`  ${done}/${count} kare (${((Date.now() - tr) / 1000).toFixed(0)} sn)`);
        }
      }),
    );
    const renderSec = (Date.now() - tr) / 1000;

    // İnşaat sahnesinin başlangıç karesi (kurgudaki yakın çekim anı): yazısız, neonlu ve neonsuz.
    const lastPage = pages[pages.length - 1]!;
    const keyframeNeon = join(o.outDir, "keyframe-neon.png");
    const keyframeClean = join(o.outDir, "keyframe-clean.png");
    if (last === total) {
      await lastPage.evaluate((s) => (window as any).studio.render(s, 30000), timeline.keyframe);
      await lastPage.evaluate(() => (window as any).studio.clean(true));
      await lastPage.screenshot({ path: keyframeNeon });
      await lastPage.evaluate(() => (window as any).studio.clean(false));
      await lastPage.screenshot({ path: keyframeClean });
    }

    // 3) Kodlama
    const te = Date.now();
    const video = join(o.outDir, o.limitFrames ? "drone-sample.mp4" : "drone.mp4");
    await new Promise<void>((res, rej) => {
      const ff = spawn(
        "ffmpeg",
        ["-v", "error", "-y", "-framerate", String(fps), "-i", join(framesDir, "%05d.jpg"),
         "-c:v", "libx264", "-crf", String(o.crf ?? 18), "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video],
        { stdio: "inherit" },
      );
      ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
    });
    const encodeSec = (Date.now() - te) / 1000;
    if ((await readdir(framesDir)).length) await rm(framesDir, { recursive: true, force: true });

    const sorted = [...frameTimes].sort((x, y) => x - y);
    return {
      video,
      keyframeNeon,
      keyframeClean,
      frames: count,
      renderer,
      seconds: { prewarm: prewarmSec, render: renderSec, encode: encodeSec, total: (Date.now() - t0) / 1000 },
      frameSeconds: {
        avg: frameTimes.reduce((x, y) => x + y, 0) / Math.max(1, frameTimes.length) / 1000,
        p50: (sorted[Math.floor(sorted.length / 2)] ?? 0) / 1000,
        max: (sorted[sorted.length - 1] ?? 0) / 1000,
      },
      timeouts,
    };
  } finally {
    // Kapanış takılırsa (Chrome bazen sayfaları bırakmıyor) iş sonsuza dek beklemesin.
    const tc = Date.now();
    await withTimeout(Promise.all(browsers.map((b) => b.close())), 15000, "Chrome kapanışı").catch((e) => log(`uyarı: ${e.message}`));
    await withTimeout(server.close(), 5000, "Vite kapanışı").catch((e) => log(`uyarı: ${e.message}`));
    log(`kapatıldı (${((Date.now() - tc) / 1000).toFixed(1)} sn)`);
  }
}
