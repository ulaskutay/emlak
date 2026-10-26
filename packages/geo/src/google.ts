/**
 * Google Places API (New) ile çevredeki yerler: hastane, okul, AVM, market, plaj, istasyon, havalimanı...
 * Anahtarda "Places API (New)" açık olmalı.
 */
import type { LatLng } from "./kml.js";
import { distanceM, poiCategoryInfo, type Poi, type PoiCategory } from "./pois.js";

/** Kategori → Google yer tipleri (Table A) ve arama yarıçapı (en fazla 50 km). */
const GOOGLE_TYPES: Partial<Record<PoiCategory, { types: string[]; radiusM: number; name?: RegExp }>> = {
  beach: { types: ["beach"], radiusM: 20000 },
  // Google kırsalda etiketleri gevşek kullanıyor (dönerci "üniversite", BİM "AVM", aile sağlığı merkezi "hastane"):
  // bu kategorilerde ad da kategoriye uymalı.
  airport: { types: ["airport"], radiusM: 50000, name: /havaliman|havaalan|airport/i },
  metro: { types: ["subway_station", "train_station", "light_rail_station"], radiusM: 10000 },
  hospital: { types: ["hospital", "general_hospital"], radiusM: 25000, name: /hastane|hospital/i },
  school: { types: ["primary_school", "secondary_school", "school"], radiusM: 5000, name: /okul|lise|kolej|school/i },
  university: { types: ["university"], radiusM: 40000, name: /üniversite|university|fakülte|yüksekokul|myo/i },
  mall: { types: ["shopping_mall"], radiusM: 25000, name: /avm|alışveriş|outlet|mall|shopping|center|merkez/i },
  park: { types: ["park"], radiusM: 3000 },
  supermarket: { types: ["supermarket", "grocery_store"], radiusM: 5000 },
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  primaryType?: string;
  location?: { latitude: number; longitude: number };
}

async function searchNearby(origin: LatLng, key: string, types: string[], radiusM: number, max: number): Promise<GooglePlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.primaryType" },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: max,
      rankPreference: "DISTANCE",
      languageCode: "tr",
      regionCode: "TR",
      locationRestriction: { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: radiusM } },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { places?: GooglePlace[] }).places ?? [];
}

/** Her kategoride en yakın `perCategory` yer. Bir kategori hata verirse diğerleri yine döner; hepsi hata verirse hata. */
export async function googleNearbyPois(origin: LatLng, key: string, perCategory = 3): Promise<Poi[]> {
  const entries = Object.entries(GOOGLE_TYPES) as [PoiCategory, { types: string[]; radiusM: number; name?: RegExp }][];
  // Fazla iste, süz: ad/tip uymayanlar elenince yine `perCategory` kadar kalsın.
  const results = await Promise.allSettled(entries.map(([, d]) => searchNearby(origin, key, d.types, d.radiusM, 10)));
  if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
  return results.flatMap((r, i) => {
    if (r.status === "rejected") return [];
    const [cat, def] = entries[i]!;
    const info = poiCategoryInfo(cat);
    return r.value
      .filter((pl) => pl.location && (!pl.primaryType || def.types.includes(pl.primaryType)) && (!def.name || def.name.test(pl.displayName?.text ?? "")))
      .slice(0, perCategory)
      .map((pl): Poi => {
        const position = { lat: pl.location!.latitude, lng: pl.location!.longitude };
        return { category: cat, label: info.label, emoji: info.emoji, name: pl.displayName?.text, position, distanceM: distanceM(origin, position), source: "google" };
      });
  });
}

/**
 * İlçe ve köy/mahalle merkezi Google metin aramasıyla ("Ezine, Çanakkale", "Dalyan, Ezine, Çanakkale").
 * Sonuç parselden 60 km'den uzaksa (yanlış eşleşme) alınmaz.
 */
export async function googleSettlements(
  origin: LatLng,
  key: string,
  place: { district?: string; province?: string; neighbourhood?: string },
): Promise<Poi[]> {
  const queries: [PoiCategory, string | null][] = [
    ["town", place.district ? [place.district, place.province].filter(Boolean).join(", ") : null],
    ["village", place.neighbourhood ? [place.neighbourhood.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, ""), place.district, place.province].filter(Boolean).join(", ") : null],
  ];
  const found = await Promise.all(
    queries.map(async ([cat, q]) => {
      if (!q) return null;
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.location" },
        body: JSON.stringify({ textQuery: q, languageCode: "tr", regionCode: "TR", pageSize: 1 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Google Places metin araması ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const pl = ((await res.json()) as { places?: GooglePlace[] }).places?.[0];
      if (!pl?.location) return null;
      const position = { lat: pl.location.latitude, lng: pl.location.longitude };
      const d = distanceM(origin, position);
      if (d > 60_000) return null;
      const info = poiCategoryInfo(cat);
      return { category: cat, label: info.label, emoji: info.emoji, name: pl.displayName?.text ?? q.split(",")[0], position, distanceM: d, source: "google" } as Poi;
    }),
  );
  return found.filter((p): p is Poi => !!p);
}

/** Yer adından konum (Google metin araması): "Acıbadem, Üsküdar, İstanbul" → mahalle merkezi. Bulunamazsa null. */
export async function geocodePlace(query: string, key: string): Promise<LatLng | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.location" },
    body: JSON.stringify({ textQuery: query, languageCode: "tr", regionCode: "TR", pageSize: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Places metin araması ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const loc = ((await res.json()) as { places?: GooglePlace[] }).places?.[0]?.location;
  return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
}
