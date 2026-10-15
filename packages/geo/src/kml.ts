/**
 * TKGM Parsel Sorgu KML'i (ve genel KML) okuyucu.
 * Bağımlılıksız: KML'deki ilk Polygon'un dış halkasını ve ExtendedData alanlarını çıkarır.
 * KML koordinat sırası "boylam,enlem[,yükseklik]" şeklindedir.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParsedKml {
  name?: string;
  /** Kapalı halka, ilk nokta tekrar edilmez. */
  ring: LatLng[];
  /** ExtendedData / SimpleData alanları (ör. Ada, ParselNo, Alan, Il, Ilce, Mahalle, Nitelik). */
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

export function parseKml(xml: string): ParsedKml {
  const outer =
    xml.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1] ??
    xml.match(/<Polygon[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1];
  if (!outer) throw new Error("KML içinde Polygon koordinatı bulunamadı");

  const ring = outer
    .trim()
    .split(/\s+/)
    .map((tuple) => tuple.split(",").map(Number))
    .filter((c) => c.length >= 2 && c.every((n) => Number.isFinite(n)))
    .map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && ring.length > 1 && first.lat === last.lat && first.lng === last.lng) ring.pop();
  if (ring.length < 3) throw new Error(`Parsel halkasında yetersiz nokta: ${ring.length}`);

  const properties: Record<string, string> = {};
  for (const m of xml.matchAll(/<(?:Simple)?Data\s+name="([^"]+)"\s*>([\s\S]*?)<\/(?:Simple)?Data>/gi)) {
    const value = m[2]!.match(/<value>([\s\S]*?)<\/value>/i)?.[1] ?? m[2]!;
    properties[m[1]!] = decode(value);
  }
  const name = xml.match(/<Placemark[\s\S]*?<name>([\s\S]*?)<\/name>/i)?.[1];
  return { name: name ? decode(name) : undefined, ring, properties };
}

/**
 * TKGM Parsel Sorgu GeoJSON çıktısı (FeatureCollection, EPSG:4326). İlk Polygon/MultiPolygon'un
 * dış halkasını ve properties alanlarını (Ada, ParselNo, Alan, Il, Ilce, Mahalle, Mevkii, Nitelik) okur.
 */
export function parseGeoJson(text: string): ParsedKml {
  const gj = JSON.parse(text) as {
    type: string;
    features?: { geometry: { type: string; coordinates: any }; properties?: Record<string, unknown> }[];
    geometry?: { type: string; coordinates: any };
    properties?: Record<string, unknown>;
  };
  const feature = gj.type === "FeatureCollection" ? gj.features?.[0] : (gj as any);
  const geom = feature?.geometry;
  if (!geom) throw new Error("GeoJSON içinde geometri bulunamadı");
  const outer: number[][] =
    geom.type === "Polygon" ? geom.coordinates[0] : geom.type === "MultiPolygon" ? geom.coordinates[0][0] : [];
  const ring = outer.map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && ring.length > 1 && first.lat === last.lat && first.lng === last.lng) ring.pop();
  if (ring.length < 3) throw new Error(`Parsel halkasında yetersiz nokta: ${ring.length}`);
  const properties = Object.fromEntries(
    Object.entries(feature.properties ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  );
  return { name: undefined, ring, properties };
}

/** Uzantıya/içeriğe göre KML veya GeoJSON okur. */
export function parseParcelFile(text: string): ParsedKml {
  return text.trimStart().startsWith("{") ? parseGeoJson(text) : parseKml(text);
}

/** TKGM "Alan" değeri ("11.091,37") → 11091.37; yoksa null. */
export function officialAreaM2(properties: Record<string, string>): number | null {
  const raw = properties.Alan ?? properties.alan;
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
