/**
 * Parsel dosyasından (TKGM GeoJSON veya KML) video için gereken her şeyi hazırlar:
 * geometri, resmî alan, zemin rakımı, adres ve çevredeki önemli noktalar.
 * Hem geliştirme sunucusu (apps/drone-studio) hem RunPod drone worker'ı kullanır.
 */
import { parseParcelFile, officialAreaM2 } from "./kml.js";
import { analyzeParcel, type ParcelGeometry } from "./parcel.js";
import { findNearbyPois, reverseGeocode, type Address, type Poi } from "./pois.js";

export interface ParcelContext {
  elevation: number | null;
  elevationSource: string | null;
  address: Address;
  pois: Poi[];
}

export interface PreparedParcel extends ParcelGeometry, ParcelContext {
  name?: string;
  properties: Record<string, string>;
  /** Koordinatlardan hesaplanan alan; areaM2 varsa TKGM'nin resmî değeridir. */
  areaComputedM2: number;
}

/**
 * Zemin rakımı (deniz seviyesine göre, m). 3D kamera merkezi bu yüksekliğe konmazsa kamera
 * yerin altına bakar (Ankara ~900 m). Google Elevation API (sunucu anahtarı gerekir), olmazsa
 * anahtarsız Open-Meteo (Copernicus DEM 90 m) — kamerayı ortalamak için birkaç metre yeterli.
 */
export async function groundElevation(
  lat: number,
  lng: number,
  googleKey?: string,
): Promise<{ meters: number; source: string } | null> {
  if (googleKey) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${googleKey}`);
      const json = (await res.json()) as { status: string; results?: { elevation: number }[] };
      if (json.status === "OK" && json.results?.[0]) return { meters: json.results[0].elevation, source: "google" };
    } catch {
      // Open-Meteo'ya düş
    }
  }
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const json = (await res.json()) as { elevation?: number[] };
    if (typeof json.elevation?.[0] === "number") return { meters: json.elevation[0], source: "open-meteo" };
  } catch {
    // rakımsız devam
  }
  return null;
}

export async function buildContext(
  centroid: { lat: number; lng: number },
  opts: { googleKey?: string; district?: string } = {},
): Promise<ParcelContext> {
  const [elev, address, pois] = await Promise.all([
    groundElevation(centroid.lat, centroid.lng, opts.googleKey),
    reverseGeocode(centroid).catch(() => ({}) as Address),
    findNearbyPois(centroid, { district: opts.district }).catch(() => [] as Poi[]),
  ]);
  return { elevation: elev?.meters ?? null, elevationSource: elev?.source ?? null, address, pois };
}

/**
 * @param cached Daha önce hesaplanmış bağlam (yavaş dış sorgular tekrarlanmasın). Çevre listesi boşsa yeniden sorgulanır.
 */
export async function prepareParcel(
  fileText: string,
  opts: { googleKey?: string; cached?: ParcelContext | null } = {},
): Promise<PreparedParcel> {
  const parsed = parseParcelFile(fileText);
  const geo = analyzeParcel(parsed.ring);
  const context =
    opts.cached && opts.cached.pois.length
      ? opts.cached
      : await buildContext(geo.centroid, { googleKey: opts.googleKey, district: parsed.properties.Ilce });
  return {
    name: parsed.name,
    properties: parsed.properties,
    ...geo,
    // TKGM'nin resmî alanı varsa o (koordinatlar yuvarlatılmış olduğu için hesaplanan yaklaşık).
    areaM2: officialAreaM2(parsed.properties) ?? geo.areaM2,
    areaComputedM2: geo.areaM2,
    ...context,
  };
}
