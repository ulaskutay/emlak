/**
 * Arsanın yandan yakın çekimi (tek kare): inşaat videosunun başlangıç karesi.
 * Kamera alçaktan, parsele yandan bakar; neon/yazı yok (isteğe bağlı neonlu hali de alınır).
 * Yerel CLI (still.ts) ve RunPod drone worker'ı (worker-still.ts) aynı kamerayı kullanır.
 */
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import type { ParcelInfo } from "../src/types.js";
import { chromeArgs, pickGlMode, withTimeout } from "./render.js";

const APP = resolve(import.meta.dirname, "..");

export { defaultSideShot, sideState, type SideShot } from "../src/side-shot.js";
import { sideState, type SideShot } from "../src/side-shot.js";

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
