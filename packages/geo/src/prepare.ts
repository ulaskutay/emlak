/**
 * Parsel dosyasından (TKGM GeoJSON veya KML) video için gereken her şeyi hazırlar:
 * geometri, resmî alan, zemin rakımı, adres ve çevredeki önemli noktalar.
 * Hem geliştirme sunucusu (apps/drone-studio) hem RunPod drone worker'ı kullanır.
 */
import { parseParcelFile, officialAreaM2 } from "./kml.js";
import { analyzeParcel, type ParcelGeometry } from "./parcel.js";
import { pickDefaultPois, poiCandidates } from "./candidates.js";
import { reverseGeocode, type Address, type Poi } from "./pois.js";
import { neighbourhoodBoundary, type Neighbourhood } from "./hood.js";

export interface ParcelContext {
  elevation: number | null;
  elevationSource: string | null;
  address: Address;
  pois: Poi[];
  /** Mahalle / köy sınırı (undefined: henüz sorgulanmadı — eski önbellek; null: bulunamadı). */
  hood?: Neighbourhood | null;
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

/**
 * @param opts.pois Kullanıcının panelde seçtiği noktalar: verilirse çevre sorgusu yapılmaz.
 * @param opts.placesKey Google Places anahtarı (yoksa yalnızca denize uzaklık hesaplanır).
 */
export async function buildContext(
  centroid: { lat: number; lng: number },
  opts: { googleKey?: string; placesKey?: string; district?: string; province?: string; neighbourhood?: string; pois?: Poi[] } = {},
): Promise<ParcelContext> {
  const [elev, address, pois, hood] = await Promise.all([
    groundElevation(centroid.lat, centroid.lng, opts.googleKey),
    reverseGeocode(centroid, opts.placesKey ?? opts.googleKey).catch(() => ({}) as Address),
    opts.pois ??
      poiCandidates(centroid, { googleKey: opts.placesKey, district: opts.district, province: opts.province, neighbourhood: opts.neighbourhood })
        .then((c) => pickDefaultPois(c.pois))
        .catch(() => [] as Poi[]),
    neighbourhoodBoundary(centroid).catch(() => null),
  ]);
  return { elevation: elev?.meters ?? null, elevationSource: elev?.source ?? null, address, pois, hood };
}

/**
 * @param cached Daha önce hesaplanmış bağlam (yavaş dış sorgular tekrarlanmasın). Çevre listesi boşsa yeniden sorgulanır.
 * @param pois Kullanıcının seçtiği çevre noktaları (boş dizi: hiç nokta yok); verilmezse otomatik seçilir (CLI).
 */
export async function prepareParcel(
  fileText: string,
  opts: { googleKey?: string; placesKey?: string; cached?: ParcelContext | null; pois?: Poi[] } = {},
): Promise<PreparedParcel> {
  const parsed = parseParcelFile(fileText);
  const geo = analyzeParcel(parsed.ring);
  // Seçili noktalar verildiyse önbellekteki rakım/adres kullanılır, çevre listesi seçimle değişir.
  // Eski (OpenStreetMap dönemi, kaynaksız) önbellek kullanılmaz: deniz/plaj mesafeleri yanlıştı.
  const cached = opts.cached?.pois.every((p) => p.source && (p.source as string) !== "osm") ? opts.cached : null;
  // opts.pois verildiyse (boş dizi dahil) kullanıcının seçimidir: otomatik seçim yapılmaz.
  const context =
    cached && (opts.pois || cached.pois.length)
      ? { ...cached, pois: opts.pois ?? cached.pois }
      : await buildContext(geo.centroid, { googleKey: opts.googleKey, placesKey: opts.placesKey, district: parsed.properties.Ilce, province: parsed.properties.Il, neighbourhood: parsed.properties.Mahalle, pois: opts.pois });
  // Mahalle sınırı (ya da ad yazımları, "Sirapinar") eklenmeden önceki önbellek: yalnızca sınır yeniden sorgulanır.
  if (context.hood === undefined || (context.hood && !context.hood.spellings))
    context.hood = (await neighbourhoodBoundary(geo.centroid).catch(() => null)) ?? context.hood;
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
