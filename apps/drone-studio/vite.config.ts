import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, relative } from "node:path";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { defineConfig, loadEnv, type Plugin } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const PARCELS_DIR = resolve(ROOT, "assets/parcels");

/**
 * GET /api/parcel?file=<assets/parcels altındaki .kml / .geojson> → geometri, alan, rakım, adres, çevre.
 * Yalnızca tarayıcı önizlemesi için; kayıt ve RunPod worker'ı parseli doğrudan hazırlayıp sayfaya verir.
 * Yavaş dış sorgular parsel klasöründe context.json olarak önbelleğe alınır (silerek yenilenir).
 */
function parcelApi(key: string): Plugin {
  return {
    name: "parcel-api",
    configureServer(server) {
      server.middlewares.use("/api/parcel", async (req, res) => {
        try {
          const file = new URL(req.url ?? "", "http://x").searchParams.get("file") ?? "";
          const path = resolve(ROOT, file);
          if (!path.startsWith(PARCELS_DIR + "/") || !/\.(kml|geojson|json)$/i.test(path)) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: "file assets/parcels altında .kml veya .geojson olmalı" }));
          }
          const cacheFile = join(PARCELS_DIR, basename(path, extname(path)), "context.json");
          const cached = existsSync(cacheFile) ? (JSON.parse(await readFile(cacheFile, "utf8")) as ParcelContext) : null;
          const parcel = await prepareParcel(await readFile(path, "utf8"), { googleKey: key, cached });
          if (parcel.pois.length) {
            await mkdir(join(cacheFile, ".."), { recursive: true });
            const { elevation, elevationSource, address, pois } = parcel;
            await writeFile(cacheFile, JSON.stringify({ elevation, elevationSource, address, pois }, null, 2));
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ file: relative(ROOT, path), ...parcel }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

/**
 * POST /api/save-approach: tarayıcı önizlemesinde kaydedilen yaklaşma çekimini diske yazar (APPROACH_OUT ya da
 * geçici klasör). Yalnız geliştirme sunucusunda; panelde kayıt R2'ye yüklenir.
 */
function saveApproachApi(): Plugin {
  return {
    name: "save-approach",
    configureServer(server) {
      server.middlewares.use("/api/save-approach", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const out = process.env.APPROACH_OUT ?? join(tmpdir(), "yaklasma.mp4");
        await writeFile(out, Buffer.concat(chunks));
        res.end(JSON.stringify({ out, bytes: Buffer.concat(chunks).length }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, "GOOGLE_MAPS_");
  return {
    envDir: ROOT,
    // Tarayıcıya yalnızca GOOGLE_MAPS_ ile başlayan değişkenler açılır (Maps JS anahtarı zaten istemci tarafı).
    // Panel derlemesinde (--mode web, /studio/) hiçbiri: dosya herkese açık; anahtar girişli kullanıcıya API'den gelir.
    envPrefix: mode === "web" ? "STUDIO_PUBLIC_" : "GOOGLE_MAPS_",
    plugins: [parcelApi(env.GOOGLE_MAPS_API_KEY ?? ""), saveApproachApi()],
    server: { port: 5178, strictPort: true },
  };
});
