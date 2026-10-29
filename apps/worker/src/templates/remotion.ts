/**
 * Remotion ile sunucuda (GPU'suz) render: kompozisyonlar apps/worker/remotion altında, paket worker ömrü boyunca bir kez
 * derlenir. Fotoğraf, ses ve yazı tipleri tarayıcıya yerel bir HTTP sunucusundan verilir (Remotion yerel yol okumaz).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { cpus } from "node:os";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const ENTRY = fileURLToPath(new URL("../../remotion/index.ts", import.meta.url));
const FONTS = fileURLToPath(new URL("../../fonts/", import.meta.url));
/** İki iş aynı anda çalışabilir (REEL_CONCURRENCY): her render çekirdeklerin yarısını alır. */
const CONCURRENCY = Number(process.env.REMOTION_CONCURRENCY) || Math.max(1, Math.floor(cpus().length / 2));

/** Remotion'un indirdiği Chrome Headless Shell yerine (macOS'ta yolda boşluk varsa açılmıyor: icudtl.dat bulunamıyor). */
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE || null;

let bundled: Promise<string> | null = null;
const serveUrl = () => (bundled ??= bundle({ entryPoint: ENTRY }).catch((e) => ((bundled = null), Promise.reject(e))));

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
};

/** Kökler altındaki dosyaları /<kök adı>/<göreli yol> adresinden veren geçici sunucu. */
async function fileServer(roots: Record<string, string>) {
  const server = createServer(async (req, res) => {
    const [, name, ...rest] = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname).split("/");
    const root = roots[name ?? ""];
    const file = root && resolve(root, rest.join("/"));
    if (!root || !file || !(file + sep).startsWith(resolve(root) + sep) || !(await stat(file).catch(() => null))?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    /** Kök altındaki dosyanın adresi. */
    url: (name: string, file: string) => `${base}/${name}/${relative(roots[name]!, file).split(sep).map(encodeURIComponent).join("/")}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/**
 * Kompozisyonu mp4'e render eder. props, dirs altındaki dosyalara url(yol) ile, yazı tiplerine fontBase ile başvurur.
 */
export async function renderComposition<P extends Record<string, unknown>>(
  id: string,
  dirs: string[],
  makeProps: (url: (file: string) => string, fontBase: string) => P,
  out: string,
  o: { log: (m: string) => void; onProgress?: (p: number) => void },
) {
  const roots = Object.fromEntries([...dirs.map((d, i) => [`d${i}`, resolve(d)]), ["f", FONTS]]);
  const files = await fileServer(roots);
  try {
    const fileUrl = (file: string) => {
      const name = Object.keys(roots).find((k) => resolve(file).startsWith(roots[k] + sep));
      if (!name) throw new Error(`Render dosyası verilen klasörlerde değil: ${file}`);
      return files.url(name, resolve(file));
    };
    const inputProps = makeProps(fileUrl, `${files.base}/f/`);
    const url = await serveUrl();
    const composition = await selectComposition({ serveUrl: url, id, inputProps, browserExecutable: BROWSER });
    const t0 = Date.now();
    await renderMedia({
      composition,
      serveUrl: url,
      codec: "h264",
      crf: 18,
      outputLocation: out,
      inputProps,
      concurrency: CONCURRENCY,
      browserExecutable: BROWSER,
      onProgress: ({ progress }) => o.onProgress?.(progress),
    });
    o.log(`render tamam: ${composition.durationInFrames} kare, ${((Date.now() - t0) / 1000).toFixed(0)} sn (eşzamanlılık ${CONCURRENCY})`);
    return out;
  } finally {
    await files.close();
  }
}
