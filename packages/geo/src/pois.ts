/**
 * Parselin çevresindeki önemli noktalar: kategoriler, mesafe ve adres.
 * Yerler Google Places'tan (google.ts), denize uzaklık yükseklik verisinden (sea.ts) gelir; candidates.ts birleştirir.
 * Kullanıcı panelde haritaya tıklayarak kendi noktasını da ekleyebilir.
 */
import type { LatLng } from "./kml.js";

export interface Poi {
  category: PoiCategory;
  label: string; // "Okul"
  emoji: string;
  name?: string;
  position: LatLng;
  distanceM: number;
  /** Kaynak: Google, uydu yükseklik verisi (deniz) ya da kullanıcının haritada işaretlediği nokta. */
  source?: "google" | "dem" | "user";
}

export type PoiCategory =
  | "sea"
  | "airport"
  | "custom"
  | "town"
  | "village"
  | "beach"
  | "metro"
  | "hospital"
  | "school"
  | "university"
  | "mall"
  | "supermarket"
  | "park"
  | "main_road";

interface CategoryDef {
  label: string;
  emoji: string;
  /** Video için önem sırası; küçük = önemli. */
  priority: number;
}

const CATEGORIES: Record<PoiCategory, CategoryDef> = {
  // Deniz: kıyının en yakın noktası (sea.ts; plaj etiketine bağlı değil).
  sea: { label: "Deniz", emoji: "🌊", priority: 0 },
  town: { label: "İlçe Merkezi", emoji: "🏙️", priority: 1 },
  beach: { label: "Plaj", emoji: "🏖️", priority: 1 },
  metro: { label: "Metro / Raylı Sistem", emoji: "🚇", priority: 1 },
  // Kullanıcının haritada işaretlediği nokta: adını kendisi verir.
  custom: { label: "Önemli Nokta", emoji: "📍", priority: 2 },
  // Google'da karşılığı yok: kullanıcı haritada işaretler.
  main_road: { label: "Ana Yol", emoji: "🛣️", priority: 2 },
  airport: { label: "Havalimanı", emoji: "✈️", priority: 3 },
  hospital: { label: "Hastane", emoji: "🏥", priority: 3 },
  school: { label: "Okul", emoji: "🏫", priority: 4 },
  village: { label: "Köy Merkezi", emoji: "🏘️", priority: 5 },
  university: { label: "Üniversite", emoji: "🎓", priority: 5 },
  mall: { label: "AVM", emoji: "🛍️", priority: 6 },
  park: { label: "Park", emoji: "🌳", priority: 7 },
  supermarket: { label: "Market", emoji: "🛒", priority: 8 },
};

/** Panelde kategori seçimi için: kimlik, etiket, simge. */
export const POI_CATEGORIES = (Object.entries(CATEGORIES) as [PoiCategory, CategoryDef][])
  .sort((a, b) => a[1].priority - b[1].priority)
  .map(([id, d]) => ({ id, label: d.label, emoji: d.emoji }));
export const poiCategoryInfo = (c: PoiCategory) => ({ label: CATEGORIES[c].label, emoji: CATEGORIES[c].emoji, priority: CATEGORIES[c].priority });

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "450 m" / "1,2 km" */
export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;

export interface Address {
  province?: string;
  district?: string;
  neighbourhood?: string;
}

/**
 * Ters coğrafi kodlama (Google Geocoding API): il / ilçe / mahalle. Anahtar yoksa ya da API kapalıysa boş döner;
 * TKGM dosyasındaki il/ilçe/mahalle zaten öncelikli kullanılır.
 */
export async function reverseGeocode(p: LatLng, key?: string): Promise<Address> {
  if (!key) return {};
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${p.lat},${p.lng}&language=tr&key=${key}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await res.json()) as { status: string; results?: { address_components: { long_name: string; types: string[] }[] }[] };
  if (j.status !== "OK") return {};
  const parts = j.results?.[0]?.address_components ?? [];
  const pick = (...types: string[]) => parts.find((c) => types.some((t) => c.types.includes(t)))?.long_name;
  return {
    province: pick("administrative_area_level_1"),
    district: pick("administrative_area_level_2", "locality"),
    neighbourhood: pick("neighborhood", "administrative_area_level_4", "sublocality_level_1", "sublocality"),
  };
}
