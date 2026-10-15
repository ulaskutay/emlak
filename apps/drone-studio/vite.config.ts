import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, relative } from "node:path";
import { analyzeParcel, findNearbyPois, officialAreaM2, parseParcelFile, reverseGeocode, type Address, type Poi } from "@arsa/geo";
import { defineConfig, loadEnv, type Plugin } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const PARCELS_DIR = resolve(ROOT, "assets/parcels");

/**
 * Zemin rakımı (deniz seviyesine göre, m). 3D kamera merkezi bu yüksekliğe konmazsa kamera
 * yerin altına bakar (Ankara ~900 m). Önce Google Elevation API, olmazsa anahtarsız Open-Meteo
 * (Copernicus DEM 90 m) — kamerayı ortalamak için birkaç metrelik hassasiyet yeterli.
 */
async function groundElevation(lat: number, lng: number, key: string): Promise<{ meters: number; source: string } | null> {
  if (key) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`);
      const json = (await res.json()) as { status: string; results?: { elevation: number }[]; error_message?: string };
      if (json.status === "OK" && json.results?.[0]) return { meters: json.results[0].elevation, source: "google" };
      console.warn(`[elevation] Google: ${json.status} — Open-Meteo deneniyor`);
    } catch (e) {
      console.warn(`[elevation] Google hatası: ${e}`);
    }
  }
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const json = (await res.json()) as { elevation?: number[] };
    if (typeof json.elevation?.[0] === "number") return { meters: json.elevation[0], source: "open-meteo" };
  } catch (e) {
    console.warn(`[elevation] Open-Meteo hatası: ${e}`);
  }
  return null;
}

/**
 * Yavaş dış sorgular (rakım, adres, çevre) parsel klasöründe context.json olarak önbelleğe alınır;
 * kayıt sırasında tekrar sorgulanmaz. Yenilemek için dosyayı silin.
 */
async function parcelContext(
  file: string,
  centroid: { lat: number; lng: number },
  key: string,
  district?: string,
): Promise<{ elevation: number | null; elevationSource: string | null; address: Address; pois: Poi[] }> {
  const dir = join(PARCELS_DIR, basename(file, extname(file)));
  const cache = join(dir, "context.json");
  if (existsSync(cache)) return JSON.parse(await readFile(cache, "utf8"));
  const [elev, address, pois] = await Promise.all([
    groundElevation(centroid.lat, centroid.lng, key),
    reverseGeocode(centroid).catch(() => ({})),
    findNearbyPois(centroid, { district }).catch((e) => (console.warn(`[pois] ${e}`), [] as Poi[])),
  ]);
  const ctx = { elevation: elev?.meters ?? null, elevationSource: elev?.source ?? null, address, pois };
  // Çevre sorgusu geçici olarak başarısız olduysa önbelleğe alma; bir sonraki çalıştırmada tekrar dene.
  if (pois.length) {
    await mkdir(dir, { recursive: true });
    await writeFile(cache, JSON.stringify(ctx, null, 2));
  }
  return ctx;
}

/** GET /api/parcel?file=<assets/parcels altındaki .kml / .geojson / .json> → geometri, alan, rakım, adres, çevre */
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
          const parsed = parseParcelFile(await readFile(path, "utf8"));
          const geo = analyzeParcel(parsed.ring);
          const ctx = await parcelContext(file, geo.centroid, key, parsed.properties.Ilce);
          // TKGM'nin resmî alanı varsa o (koordinatlar yuvarlatılmış olduğu için hesaplanan yaklaşık).
          const official = officialAreaM2(parsed.properties);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              file: relative(ROOT, path),
              name: parsed.name,
              properties: parsed.properties,
              ...geo,
              areaM2: official ?? geo.areaM2,
              areaComputedM2: geo.areaM2,
              ...ctx,
            }),
          );
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
