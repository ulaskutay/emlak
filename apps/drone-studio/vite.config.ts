import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { analyzeParcel, parseKml } from "@arsa/geo";
import { defineConfig, loadEnv, type Plugin } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const PARCELS_DIR = resolve(ROOT, "assets/parcels");

/** Google Elevation API ile zemin rakımı (deniz seviyesine göre, m). 3D kamera merkezi için gerekli. */
async function groundElevation(lat: number, lng: number, key: string): Promise<number | null> {
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`;
  const res = await fetch(url);
  const json = (await res.json()) as { status: string; results?: { elevation: number }[]; error_message?: string };
  if (json.status !== "OK" || !json.results?.[0]) {
    console.warn(`[elevation] ${json.status} ${json.error_message ?? ""} — rakım 0 kabul ediliyor`);
    return null;
  }
  return json.results[0].elevation;
}

/** GET /api/parcel?file=<assets/parcels altındaki .kml> → parsel geometrisi + rakım */
function parcelApi(key: string): Plugin {
  return {
    name: "parcel-api",
    configureServer(server) {
      server.middlewares.use("/api/parcel", async (req, res) => {
        try {
          const file = new URL(req.url ?? "", "http://x").searchParams.get("file") ?? "";
          const path = resolve(ROOT, file);
          if (!path.startsWith(PARCELS_DIR + "/") || !path.endsWith(".kml")) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: "file assets/parcels altında bir .kml olmalı" }));
          }
          const kml = parseKml(await readFile(path, "utf8"));
          const geo = analyzeParcel(kml.ring);
          const elevation = key ? await groundElevation(geo.centroid.lat, geo.centroid.lng, key) : null;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ file: relative(ROOT, path), name: kml.name, properties: kml.properties, ...geo, elevation }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, "GOOGLE_MAPS_");
  return {
    envDir: ROOT,
    // Tarayıcıya yalnızca GOOGLE_MAPS_ ile başlayan değişkenler açılır (Maps JS anahtarı zaten istemci tarafı).
    envPrefix: "GOOGLE_MAPS_",
    plugins: [parcelApi(env.GOOGLE_MAPS_API_KEY ?? "")],
    server: { port: 5178, strictPort: true },
  };
});
