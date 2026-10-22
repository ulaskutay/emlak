/**
 * Arsanın yandan yakın çekimi (tek kare): inşaat videosunun başlangıç karesi.
 * Kamera alçaktan, parsele yandan bakar; neon/yazı yok (isteğe bağlı neonlu hali de alınır).
 * Yerel CLI (still.ts) ve RunPod drone worker'ı (worker-still.ts) aynı kamerayı kullanır.
 */
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import type { FrameState, ParcelInfo } from "../src/types.js";
import { chromeArgs, pickGlMode, withTimeout } from "./render.js";

const APP = resolve(import.meta.dirname, "..");

export interface SideShot {
  /** Parselin en uzun kenarına göre bakış yönü (derece). */
  heading: number;
  /** Yatay uzaklık: parsel yarıçapının katı. */
  dist: number;
  /** Kameranın yerden yüksekliği (m). */
  height: number;
}

/**
 * Varsayılan açı (Ezine denemesinde seçilen): en uzun kenara dik, 1,6 yarıçap uzaktan; yükseklik uzaklığın ~%30'u
 * (yaklaşık 17° aşağı bakış). Arsa karenin alt üçte ikisini doldurur, üstte ufuk ve biraz gökyüzü kalır.
 */
export function defaultSideShot(p: ParcelInfo): SideShot {
  const D = Math.max(25, p.radiusM) * 1.6;
  return { heading: 90, dist: 1.6, height: Math.round(Math.min(80, Math.max(20, D * 0.3))) };
}

/** Yandan alçak kamera: yatay uzaklık D, yükseklik H → Cesium range/tilt (tilt = 90 + pitch). */
export function sideState(p: ParcelInfo, s: SideShot): FrameState {
  const D = Math.max(25, p.radiusM) * s.dist;
  return {
    camera: {
      lat: p.centroid.lat,
      lng: p.centroid.lng,
      altitude: 0,
      range: Math.hypot(D, s.height),
      tilt: 90 - (Math.atan2(s.height, D) * 180) / Math.PI,
      heading: p.longestEdgeHeading + s.heading,
    },
    mode: "SATELLITE",
    neon: 0,
    fill: 0,
    fence: 0,
  };
}

/** Kareleri çizer: her açı için side-<yön>-<uzaklık>.png (neon: true ise …-neon.png da). Yazılan dosyaları döndürür. */
export async function renderSideShots(o: {
  parcel: ParcelInfo;
  googleKey: string;
  shots: SideShot[];
  outDir: string;
  neon?: boolean;
  port?: number;
  headless?: boolean;
  log?: (m: string) => void;
}): Promise<{ clean: string; neon?: string; shot: SideShot }[]> {
  const log = o.log ?? (() => {});
  const port = o.port ?? 5179;
  const server = await createServer({
    root: APP,
    configFile: join(APP, "vite.config.ts"),
    logLevel: "warn",
    server: { port, strictPort: true, watch: null },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? `http://localhost:${port}/`;
  const glMode = await pickGlMode(log);
  log(`WebGL arka ucu: ${glMode}`);
  const browser = await withTimeout(chromium.launch({ channel: "chrome", headless: o.headless ?? true, args: chromeArgs(glMode) }), 60000, "Chrome açılışı");
  const out: { clean: string; neon?: string; shot: SideShot }[] = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
    await page.addInitScript(() => ((window as any).__RECORDER__ = true));
    await withTimeout(page.goto(url), 60000, "sayfa yüklemesi");
    await withTimeout(page.evaluate(([p, k]) => (window as any).studio.loadParcel(p, k), [o.parcel, o.googleKey] as const), 150000, "harita yüklemesi");
    await page.evaluate(() => (window as any).studio.setChrome(false));
    for (const shot of o.shots) {
      const name = `side-${shot.heading}-${shot.dist}`;
      await withTimeout(page.evaluate((s) => (window as any).studio.render(s, 30000), sideState(o.parcel, shot)), 60000, "kare çizimi");
      await page.evaluate(() => (window as any).studio.clean(false));
      const clean = join(o.outDir, `${name}.png`);
      await page.screenshot({ path: clean });
      const item: { clean: string; neon?: string; shot: SideShot } = { clean, shot };
      if (o.neon) {
        await withTimeout(page.evaluate((s) => (window as any).studio.render(s, 30000), { ...sideState(o.parcel, shot), neon: 1, fill: 0.25 }), 60000, "kare çizimi");
        await page.evaluate(() => (window as any).studio.clean(true));
        item.neon = join(o.outDir, `${name}-neon.png`);
        await page.screenshot({ path: item.neon });
      }
      log(`kare: ${clean}`);
      out.push(item);
    }
  } finally {
    await withTimeout(browser.close(), 10000, "Chrome kapanışı").catch(() => {});
    await server.close();
  }
  return out;
}
