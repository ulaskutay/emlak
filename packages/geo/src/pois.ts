/**
 * Parselin çevresindeki önemli noktalar (okul, hastane, AVM, ulaşım, park, ana yol...).
 * Kaynak: OpenStreetMap Overpass API (ücretsiz, anahtarsız). Adres için Nominatim ters coğrafi kodlama.
 */
import type { LatLng } from "./kml.js";

export interface Poi {
  category: PoiCategory;
  label: string; // "Okul"
  emoji: string;
  name?: string;
  position: LatLng;
  distanceM: number;
}

export type PoiCategory =
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
  /** Overpass sorgu parçaları ({{R}} = yarıçap, {{C}} = "lat,lng"). */
  queries: string[];
  /** Video için önem sırası; küçük = önemli. */
  priority: number;
  /** Kategoriye özel sabit arama yarıçapı (m); yoksa genel yarıçap. Kırsalda ilçe merkezi/deniz uzakta olabilir. */
  radiusM?: number;
  /** Yol/kıyı gibi çizgisel öğeler: en yakın noktayı bulmak için geometri gerekir (ağır sorgu). */
  linear?: boolean;
}

const CATEGORIES: Record<PoiCategory, CategoryDef> = {

  town: {
    label: "İlçe Merkezi",
    emoji: "🏙️",
    priority: 1,
    radiusM: 25000,
    queries: ['node["place"~"^(town|city)$"](around:{{R}},{{C}});'],
  },
  // Kıyı çizgisi geometrisi Overpass'ta çok ağır (zaman aşımı); denize uzaklık en yakın plajdan ölçülür.
  beach: { label: "Deniz / Plaj", emoji: "🏖️", priority: 0, radiusM: 15000, queries: ['nwr["natural"="beach"](around:{{R}},{{C}});'] },
  village: { label: "Köy Merkezi", emoji: "🏘️", priority: 5, queries: ['node["place"~"^(village|suburb)$"](around:{{R}},{{C}});'] },
  metro: {
    label: "Metro / Raylı Sistem",
    emoji: "🚇",
    priority: 1,
    queries: ['node["railway"="station"](around:{{R}},{{C}});', 'node["station"="subway"](around:{{R}},{{C}});'],
  },
  main_road: {
    label: "Ana Yol",
    emoji: "🛣️",
    priority: 2,
    linear: true,
    radiusM: 3000,
    queries: ['way["highway"~"^(motorway|trunk|primary)$"](around:{{R}},{{C}});'],
  },
  hospital: { label: "Hastane", emoji: "🏥", priority: 3, queries: ['nwr["amenity"="hospital"](around:{{R}},{{C}});'] },
  school: { label: "Okul", emoji: "🏫", priority: 4, queries: ['nwr["amenity"="school"](around:{{R}},{{C}});'] },
  university: { label: "Üniversite", emoji: "🎓", priority: 5, queries: ['nwr["amenity"="university"](around:{{R}},{{C}});'] },
  mall: { label: "AVM", emoji: "🛍️", priority: 6, queries: ['nwr["shop"="mall"](around:{{R}},{{C}});'] },
  park: { label: "Park", emoji: "🌳", priority: 7, queries: ['nwr["leisure"="park"](around:{{R}},{{C}});'] },
  supermarket: { label: "Market", emoji: "🛒", priority: 8, queries: ['nwr["shop"="supermarket"](around:{{R}},{{C}});'] },
};

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OsmElement {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Elemanın merkeze en yakın noktası (yollar/kıyı için geometrinin en yakın köşesi). */
function nearestPoint(el: OsmElement, origin: LatLng): LatLng | null {
  const pts = el.geometry?.length
    ? el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))
    : el.lat !== undefined
      ? [{ lat: el.lat, lng: el.lon! }]
      : el.center
        ? [{ lat: el.center.lat, lng: el.center.lon }]
        : [];
  let best: LatLng | null = null;
  let bestD = Infinity;
  for (const p of pts) {
    const d = distanceM(origin, p);
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best;
}

/** Ana sunucu yoğunken 502/504 verebiliyor; sırayla aynalar denenir. */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function overpass(query: string): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "arsa-video/0.1 (emlak tanitim)" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Overpass sunucularının hiçbiri yanıt vermedi: ${lastError}`);
}

/**
 * Yakın çevredeki önemli noktalar. Kırsal arazide 3 km içinde yeterli nokta yoksa yarıçap
 * 8 km'ye genişletilir (arsa satışında "ilçe merkezine 6 km" bilgisi de değerlidir).
 */
export async function findNearbyPois(
  origin: LatLng,
  opts: { radiusM?: number; limit?: number; district?: string } = {},
): Promise<Poi[]> {
  const near = await findPoisWithin(origin, opts.radiusM ?? 3000, opts.limit, opts.district);
  if (opts.radiusM || near.length >= 3) return near;
  return findPoisWithin(origin, 8000, opts.limit, opts.district);
}

const norm = (s?: string) => (s ?? "").toLocaleLowerCase("tr-TR").trim();

async function findPoisWithin(origin: LatLng, radius: number, limit = 5, district?: string): Promise<Poi[]> {
  const c = `${origin.lat},${origin.lng}`;
  const build = (linear: boolean) =>
    Object.values(CATEGORIES)
      .filter((d) => !!d.linear === linear)
      .flatMap((d) => d.queries.map((q) => q.replaceAll("{{R}}", String(d.radiusM ?? radius)).replaceAll("{{C}}", c)))
      .join("");
  // Noktasal öğeler hafif (merkez yeterli); yol/kıyı için geometri gerekir — iki ayrı sorgu.
  // Çizgisel sorgu (ana yol) başarısız olursa noktasal sonuçlarla devam edilir.
  const [points, lines] = await Promise.all([
    overpass(`[out:json][timeout:30];(${build(false)});out tags center;`),
    overpass(`[out:json][timeout:40];(${build(true)});out tags geom;`).catch(() => [] as OsmElement[]),
  ]);
  const elements = [...points, ...lines];

  const categorize = (t: Record<string, string>): PoiCategory | null => {
    if (t.place === "town" || t.place === "city") return "town";
    if (t.place === "village" || t.place === "suburb") return "village";
    if (t.natural === "beach") return "beach";
    if (t.railway === "station" || t.station === "subway") return "metro";
    if (/^(motorway|trunk|primary)$/.test(t.highway ?? "")) return "main_road";
    if (t.amenity === "hospital") return "hospital";
    if (t.amenity === "school") return "school";
    if (t.amenity === "university") return "university";
    if (t.shop === "mall") return "mall";
    if (t.leisure === "park") return "park";
    if (t.shop === "supermarket") return "supermarket";
    return null;
  };

  const nearest = new Map<PoiCategory, Poi>();
  for (const el of elements) {
    const cat = categorize(el.tags ?? {});
    if (!cat) continue;
    const p = nearestPoint(el, origin);
    if (!p) continue;
    const d = distanceM(origin, p);
    const prev = nearest.get(cat);
    // İlçe merkezi: en yakın kasaba değil, parselin bağlı olduğu ilçenin merkezi (ör. Bozcaada değil Ezine).
    const isDistrict = cat === "town" && !!district && norm(el.tags?.name) === norm(district);
    const prevIsDistrict = cat === "town" && !!district && norm(prev?.name) === norm(district);
    if (!prev || (isDistrict && !prevIsDistrict) || (d < prev.distanceM && !prevIsDistrict)) {
      const def = CATEGORIES[cat];
      nearest.set(cat, { category: cat, label: def.label, emoji: def.emoji, name: el.tags?.name, position: p, distanceM: d });
    }
  }
  // Önem sırası öncelikli, eşitlikte yakın olan; videoda okunabilirlik için en fazla `limit` tane.
  return [...nearest.values()]
    .sort((a, b) => CATEGORIES[a.category].priority - CATEGORIES[b.category].priority || a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** "450 m" / "1,2 km" */
export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;

export interface Address {
  province?: string;
  district?: string;
  neighbourhood?: string;
}

/** Nominatim ters coğrafi kodlama: il / ilçe / mahalle. */
export async function reverseGeocode(p: LatLng): Promise<Address> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=16&accept-language=tr`,
    { headers: { "User-Agent": "arsa-video/0.1 (emlak tanitim)" } },
  );
  if (!res.ok) return {};
  const j = (await res.json()) as { address?: Record<string, string> };
  const a = j.address ?? {};
  return {
    province: a.province ?? a.state ?? a.city,
    district: a.town ?? a.city_district ?? a.county ?? a.district,
    neighbourhood: a.neighbourhood ?? a.suburb ?? a.quarter ?? a.village,
  };
}
