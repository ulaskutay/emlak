/**
 * Parselin bulunduğu mahallenin / köyün sınırı (videoda neon çizgiyle çizilir).
 *
 * 1. TKGM (Parsel Sorgu'nun kullandığı servis): noktadan ilçe + mahalle kimliği, ilçenin mahalle çokgenleri.
 *    Kırsal Türkiye'de de eksiksiz (OSM'de çoğu köyün sınırı yok).
 * 2. OpenStreetMap: noktayı içeren 8–10. seviye idari sınır.
 * Resmî bir genel API olmadığı için sonuç context.json / veritabanında önbelleklenir; bulunamazsa video sınırsız üretilir.
 */
import type { LatLng } from "./kml.js";

export interface Neighbourhood {
  name: string;
  /** Dış sınır (kapalı değil: ilk nokta sonda tekrarlanmaz), sadeleştirilmiş. */
  ring: LatLng[];
  source: "tkgm" | "osm";
  /**
   * Adın başka kaynaklardaki yazımları (TKGM parsel kaydı, OpenStreetMap köy / mahalle / ilçe). TKGM adlarında "ı" bazen "i" yazılıyor
   * ("Sirapinar"); seslendirme metni doğru yazımı buradan alır.
   */
  spellings?: string[];
}

const TKGM = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api";
const UA = { "User-Agent": "Mozilla/5.0 (arsa-video)", Accept: "application/json" };

async function getJson<T>(url: string, ms = 20000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

type GeoPolygon = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };

/** Çokgen/çoklu çokgenden en büyük dış halka. */
function outerRing(g: GeoPolygon): LatLng[] {
  const rings = g.type === "Polygon" ? [(g.coordinates as number[][][])[0]!] : (g.coordinates as number[][][][]).map((p) => p[0]!);
  const best = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const pts = best.map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
  const [f, l] = [pts[0], pts[pts.length - 1]];
  return f && l && f.lat === l.lat && f.lng === l.lng ? pts.slice(0, -1) : pts;
}

async function fromTkgm(p: LatLng): Promise<Neighbourhood | null> {
  const parcel = await getJson<{ properties?: { ilceId?: number; mahalleId?: number; mahalleAd?: string } }>(
    `${TKGM}/parsel/${p.lat.toFixed(6)}/${p.lng.toFixed(6)}/`,
  );
  const { ilceId, mahalleId, mahalleAd } = parcel.properties ?? {};
  if (!ilceId || !mahalleId) return null;
  const list = await getJson<{ features: { geometry: GeoPolygon; properties: { id: number; text: string } }[] }>(
    `${TKGM}/idariYapi/mahalleListe/${ilceId}`,
    30000,
  );
  const f = list.features.find((x) => x.properties.id === mahalleId);
  if (!f) return null;
  // Liste adı ile parsel adı farklı yerlerde "ı"yı kaybediyor ("Balikli Köyü" / "Kızılköy"): ikisi de yazım kaynağı.
  return { name: f.properties.text || mahalleAd || "", ring: outerRing(f.geometry), source: "tkgm", spellings: mahalleAd ? [mahalleAd] : [] };
}

/** OSM ilişkisinin dış yollarını uç uca ekleyip halka kurar. */
function stitch(ways: LatLng[][]): LatLng[] {
  const key = (q: LatLng) => `${q.lat.toFixed(7)},${q.lng.toFixed(7)}`;
  const rest = ways.filter((w) => w.length > 1).map((w) => [...w]);
  const ring = rest.shift() ?? [];
  while (rest.length) {
    const end = key(ring[ring.length - 1]!);
    const i = rest.findIndex((w) => key(w[0]!) === end || key(w[w.length - 1]!) === end);
    if (i < 0) break;
    const w = rest.splice(i, 1)[0]!;
    ring.push(...(key(w[0]!) === end ? w : w.reverse()).slice(1));
  }
  return ring;
}

async function fromOsm(p: LatLng): Promise<Neighbourhood | null> {
  const q = `[out:json][timeout:25];is_in(${p.lat},${p.lng})->.a;rel(pivot.a)["boundary"="administrative"]["admin_level"~"^(8|9|10)$"];out geom;`;
  for (const host of ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]) {
    try {
      const res = await fetch(host, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements: { tags?: Record<string, string>; members?: { role: string; geometry?: { lat: number; lon: number }[] }[] }[];
      };
      // En küçük (en ayrıntılı) seviye: mahalle.
      const rel = json.elements.sort((a, b) => Number(b.tags?.admin_level ?? 0) - Number(a.tags?.admin_level ?? 0))[0];
      if (!rel?.members) return null;
      const ring = stitch(rel.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry!.map((g) => ({ lat: g.lat, lng: g.lon }))));
      return ring.length > 3 ? { name: rel.tags?.name ?? "", ring, source: "osm" } : null;
    } catch {
      // sonraki sunucu
    }
  }
  return null;
}

/** Douglas–Peucker (metre cinsinden tolerans): çizim akıcı kalsın diye en fazla birkaç yüz nokta. */
export function simplifyRing(ring: LatLng[], toleranceM: number): LatLng[] {
  if (ring.length < 5) return ring;
  const k = Math.cos((ring[0]!.lat * Math.PI) / 180) * 111_320;
  const xy = ring.map((q) => [q.lng * k, q.lat * 111_320] as const);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a]!;
    const [bx, by] = xy[b]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1;
    let dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]!;
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > dmax) (dmax = d), (far = i);
    }
    if (far > 0 && dmax > toleranceM) (keep[far] = 1), stack.push([a, far], [far, b]);
  }
  return ring.filter((_, i) => keep[i]);
}

/** Nominatim ters kodlaması: noktanın köy / mahalle / ilçe / il adları (Türkçe yazımıyla). */
async function osmPlaceNames(p: LatLng): Promise<string[]> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lng}&zoom=14&format=json&accept-language=tr`;
  const j = await getJson<{ address?: Record<string, string> }>(url, 10000);
  return Object.entries(j.address ?? {})
    .filter(([k]) => !/^(ISO|postcode|country|region)/.test(k))
    .map(([, v]) => v);
}

export async function neighbourhoodBoundary(p: LatLng): Promise<Neighbourhood | null> {
  let hood: Neighbourhood | null = null;
  const spellings = osmPlaceNames(p).catch(() => [] as string[]);
  try {
    hood = await fromTkgm(p);
  } catch {
    // OSM'ye düş
  }
  hood ??= await fromOsm(p).catch(() => null);
  if (!hood || hood.ring.length < 3) return null;
  // Uzunluğa göre tolerans: büyük köy sınırında 8 m, küçük mahallede 3 m.
  let ring = simplifyRing(hood.ring, 3);
  for (let tol = 6; ring.length > 300; tol *= 1.6) ring = simplifyRing(hood.ring, tol);
  return { ...hood, ring, spellings: [...(hood.spellings ?? []), ...(await spellings)] };
}
