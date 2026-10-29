/**
 * RunPod drone worker'ının "yaklaşma çekimi" işi (gpu/drone-worker/handler.py, input.approach): inşaat videosunun
 * açılışı. Kamera mahallenin yukarısından parsele iner ve yan karenin (side.ts) kamerasında durur. Çizim ve kodlama
 * panelde kullanılan kodla aynı (src/approach.ts, WebCodecs); burada GPU'lu Chrome'da, tam çözünürlükte çalışır.
 *
 *   tsx scripts/worker-approach.ts --in /tmp/job/parcel.geojson --out /tmp/job [--context ctx.json] [--seconds 6]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel } from "@arsa/geo";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import type { ParcelInfo } from "../src/types.js";
import { chromeArgs, pickGlMode, withTimeout } from "./render.js";

const APP = resolve(import.meta.dirname, "..");

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    in: { type: "string" },
    out: { type: "string" },
    context: { type: "string" },
    seconds: { type: "string", default: "6" },
  },
});
if (!args.in || !args.out) throw new Error("--in <parsel dosyası> --out <klasör> gerekli");
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) throw new Error("GOOGLE_MAPS_API_KEY ortam değişkeni yok");
const log = (m: string) => console.error(`[worker] ${m}`);

await mkdir(args.out, { recursive: true });
const t0 = Date.now();
const cached = args.context ? JSON.parse(await readFile(args.context, "utf8")) : null;
const parcel = (await prepareParcel(await readFile(args.in, "utf8"), { googleKey: process.env.GOOGLE_ELEVATION_API_KEY, cached })) as unknown as ParcelInfo;

const server = await createServer({ root: APP, configFile: join(APP, "vite.config.ts"), logLevel: "warn", server: { port: 5180, strictPort: true, watch: null } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5180/";
const glMode = await pickGlMode(log);
log(`WebGL arka ucu: ${glMode}`);
const browser = await withTimeout(chromium.launch({ channel: "chrome", headless: true, args: chromeArgs(glMode) }), 60000, "Chrome açılışı");
const file = join(args.out, "approach.mp4");
try {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
  await page.addInitScript(() => ((window as any).__RECORDER__ = true));
  await page.exposeFunction("__progress", (d: number) => log(`yaklaşma %${Math.round(d * 100)}`));
  await withTimeout(page.goto(url), 60000, "sayfa yüklemesi");
  await withTimeout(page.evaluate(([p, k]) => (window as any).studio.loadParcel(p, k), [parcel, key] as const), 150000, "harita yüklemesi");
  log(`harita hazır (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  // Metin olarak: tsx'in eklediği yardımcılar (__name) sayfada tanımlı değil.
  const b64 = (await withTimeout(
    page.evaluate(`(async () => {
      let last = -1;
      const blob = await window.studio.recordApproach({
        seconds: ${Number(args.seconds)}, width: 1080, height: 1920,
        onProgress: (d) => { const s = Math.floor(d * 10); if (s !== last) { last = s; window.__progress(d); } },
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    })()`),
    360000,
    "yaklaşma çizimi",
  )) as string;
  await writeFile(file, Buffer.from(b64, "base64"));
} finally {
  await withTimeout(browser.close(), 10000, "Chrome kapanışı").catch(() => {});
  await server.close();
}

// handler.py son satırı JSON olarak okur
console.log(JSON.stringify({ video: file, seconds: (Date.now() - t0) / 1000 }));
process.exit(0);
