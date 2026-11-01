/**
 * TKGM Parsel Sorgu KML / GeoJSON okuyucu (bağımlılıksız).
 * Dosyada birden çok parsel olabilir (yan yana ya da parçalı arsa): her Placemark / Feature ve
 * MultiPolygon'un her parçası ayrı halka olur; özellikler (Ada, ParselNo, Alan...) tek kayıtta birleşir.
 * KML koordinat sırası "boylam,enlem[,yükseklik]" şeklindedir.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParsedKml {
  name?: string;
  /** İlk parselin halkası (kapalı, ilk nokta tekrar edilmez). */
  ring: LatLng[];
  /** Tüm parsellerin halkaları (en az bir). */
  rings: LatLng[][];
  /** ExtendedData / properties alanları (ör. Ada, ParselNo, Alan, Il, Ilce, Mahalle, Nitelik); çok parselde birleşik. */
  properties: Record<string, string>;
}

/** Tek bir parsel kaydı: halkaları ve kendi özellikleri. */
export interface ParcelFeature {
  rings: LatLng[][];
  properties: Record<string, string>;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/** Kapanış noktası tekrar ediyorsa atar; 3 köşeden azsa null. */
function closeRing(ring: LatLng[]): LatLng[] | null {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && ring.length > 1 && first.lat === last.lat && first.lng === last.lng) ring.pop();
  return ring.length >= 3 ? ring : null;
}

function kmlFeature(xml: string): ParcelFeature | null {
  const rings: LatLng[][] = [];
  for (const poly of xml.matchAll(/<Polygon[\s\S]*?<\/Polygon>/gi)) {
    const outer =
      poly[0].match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1] ??
      poly[0].match(/<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1];
    if (!outer) continue;
    const ring = closeRing(
      outer
        .trim()
        .split(/\s+/)
        .map((tuple) => tuple.split(",").map(Number))
        .filter((c) => c.length >= 2 && c.every((n) => Number.isFinite(n)))
        .map(([lng, lat]) => ({ lat: lat!, lng: lng! })),
    );
    if (ring) rings.push(ring);
  }
  if (!rings.length) return null;
  const properties: Record<string, string> = {};
  for (const m of xml.matchAll(/<(?:Simple)?Data\s+name="([^"]+)"\s*>([\s\S]*?)<\/(?:Simple)?Data>/gi)) {
    const value = m[2]!.match(/<value>([\s\S]*?)<\/value>/i)?.[1] ?? m[2]!;
    properties[m[1]!] = decode(value);
  }
  return { rings, properties };
}

export function kmlFeatures(xml: string): ParcelFeature[] {
  const placemarks = [...xml.matchAll(/<Placemark[\s\S]*?<\/Placemark>/gi)].map((m) => m[0]);
  const features = (placemarks.length ? placemarks : [xml]).map(kmlFeature).filter((f): f is ParcelFeature => !!f);
  if (!features.length) throw new Error("KML içinde Polygon koordinatı bulunamadı");
  return features;
}

/** TKGM Parsel Sorgu GeoJSON çıktısı (FeatureCollection, EPSG:4326): her Feature'ın Polygon/MultiPolygon dış halkaları. */
export function geoJsonFeatures(text: string): ParcelFeature[] {
  const gj = JSON.parse(text) as { type: string; features?: any[] };
  const list: any[] = gj.type === "FeatureCollection" ? (gj.features ?? []) : [gj];
  const features: ParcelFeature[] = [];
  for (const f of list) {
    const geom = f?.geometry ?? (f?.type === "Polygon" || f?.type === "MultiPolygon" ? f : null);
    if (!geom) continue;
    const polys: number[][][] = geom.type === "Polygon" ? [geom.coordinates[0]] : geom.type === "MultiPolygon" ? geom.coordinates.map((p: number[][][]) => p[0]) : [];
    const rings = polys.map((outer) => closeRing(outer.map(([lng, lat]) => ({ lat: lat!, lng: lng! })))).filter((r): r is LatLng[] => !!r);
    if (!rings.length) continue;
    const properties = Object.fromEntries(Object.entries(f.properties ?? {}).map(([k, v]) => [k, String(v ?? "")]));
    features.push({ rings, properties });
  }
  if (!features.length) throw new Error("GeoJSON içinde parsel geometrisi bulunamadı");
  return features;
}

/** Uzantıya/içeriğe göre KML veya GeoJSON'daki parsel kayıtları. */
export function parseParcelFeatures(text: string): ParcelFeature[] {
  return text.trimStart().startsWith("{") ? geoJsonFeatures(text) : kmlFeatures(text);
}

/** TKGM "Alan" değeri ("11.091,37") → 11091.37; yoksa null. */
export function officialAreaM2(properties: Record<string, string>): number | null {
  const raw = properties.Alan ?? properties.alan;
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 11091.37 → "11.091,37" (TKGM biçimi; officialAreaM2 geri okur). */
function tkgmArea(m2: number): string {
  const [int, dec] = m2.toFixed(2).split(".");
  return `${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/**
 * Parsel kayıtlarının özelliklerini tek kayda birleştirir. Ada/ParselNo: aynı adada Ada tek, ParselNo liste;
 * farklı adalarda ikisi de sıralı liste (@arsa/shared parcelPairs ile okunur). Alan toplanır (birinde yoksa
 * atılır: koordinatlardan hesaplanır). Diğer alanların farklı değerleri virgülle birleşir.
 */
export function mergeProperties(list: Record<string, string>[]): Record<string, string> {
  if (list.length <= 1) return { ...list[0] };
  const out: Record<string, string> = {};
  const keys = [...new Set(list.flatMap((p) => Object.keys(p)))];
  for (const k of keys) {
    if (k === "Ada" || k === "ParselNo" || k === "Alan" || k === "alan") continue;
    const vals = [...new Set(list.map((p) => p[k]?.trim()).filter((v): v is string => !!v))];
    if (vals.length) out[k] = vals.join(", ");
  }
  const pairs = list.filter((p) => p.Ada && p.ParselNo).map((p) => ({ ada: p.Ada!.trim(), parsel: p.ParselNo!.trim() }));
  if (pairs.length) {
    const adas = [...new Set(pairs.map((p) => p.ada))];
    out.Ada = adas.length === 1 ? adas[0]! : pairs.map((p) => p.ada).join(", ");
    out.ParselNo = pairs.map((p) => p.parsel).join(", ");
  }
  const areas = list.map(officialAreaM2);
  if (areas.every((a) => a !== null)) out.Alan = tkgmArea(areas.reduce((s, a) => s + a!, 0));
  return out;
}

/** Aynı parsel iki kez eklendiyse (aynı ada/parsel ya da aynı halka) bir kez sayılır. */
function dedupe(features: ParcelFeature[]): ParcelFeature[] {
  const seen = new Set<string>();
  return features.filter((f) => {
    const p = f.properties;
    const key = p.Ada && p.ParselNo ? `${p.Mahalle ?? ""}|${p.Ada}|${p.ParselNo}` : JSON.stringify(f.rings);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Dosyadaki tüm parseller: halkalar ve birleşik özellikler. */
export function parseParcelFile(text: string): ParsedKml {
  const features = dedupe(parseParcelFeatures(text));
  const rings = features.flatMap((f) => f.rings);
  const name = text.trimStart().startsWith("{") ? undefined : text.match(/<Placemark[\s\S]*?<name>([\s\S]*?)<\/name>/i)?.[1];
  return { name: name ? decode(name) : undefined, ring: rings[0]!, rings, properties: mergeProperties(features.map((f) => f.properties)) };
}

/** Birden çok parsel dosyasını (KML ya da GeoJSON) tek GeoJSON FeatureCollection'da birleştirir. */
export function mergeParcelFiles(texts: string[]): string {
  const features = dedupe(texts.flatMap((t) => parseParcelFeatures(t)));
  return JSON.stringify({
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry:
        f.rings.length === 1
          ? { type: "Polygon", coordinates: [[...f.rings[0]!, f.rings[0]![0]!].map((q) => [q.lng, q.lat])] }
          : { type: "MultiPolygon", coordinates: f.rings.map((r) => [[...r, r[0]!].map((q) => [q.lng, q.lat])]) },
      properties: f.properties,
    })),
    crs: { type: "name", properties: { name: "EPSG:4326" } },
  });
}
