import type { LatLng } from "./kml.js";

const R = 6_378_137; // WGS84 ekvator yarıçapı (m)
const rad = (d: number) => (d * Math.PI) / 180;

/** Halkayı merkez etrafında yerel düzleme (metre) izdüşürür; parsel ölçeğinde hata ihmal edilebilir. */
function toLocal(ring: LatLng[], origin: LatLng): { x: number; y: number }[] {
  const cosLat = Math.cos(rad(origin.lat));
  return ring.map((p) => ({ x: rad(p.lng - origin.lng) * R * cosLat, y: rad(p.lat - origin.lat) * R }));
}

export interface ParcelGeometry {
  /** İlk parselin halkası. */
  ring: LatLng[];
  /** Tüm parseller (yan yana ya da parçalı arsada birden çok); değerler hepsinin toplamına göredir. */
  rings: LatLng[][];
  centroid: LatLng;
  areaM2: number;
  /** Merkezden en uzak köşeye mesafe (m) — kamera mesafesini belirlemek için. */
  radiusM: number;
  /** En uzun kenarın pusula yönü (derece) — kamerayı parsele hizalamak için. */
  longestEdgeHeading: number;
}

/** Tek halka ya da birden çok parselin halkaları: toplam alan, alan ağırlıklı ortak merkez. */
export function analyzeParcel(input: LatLng[] | LatLng[][]): ParcelGeometry {
  const rings = (Array.isArray(input[0]) ? input : [input]) as LatLng[][];
  const all = rings.flat();
  const approx = {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
  const local = rings.map((r) => toLocal(r, approx));

  // Shoelace: alan ve alan ağırlıklı ağırlık merkezi (halka yönü fark etmesin diye her halka kendi işaretiyle)
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (const pts of local) {
    let a2 = 0;
    let rx = 0;
    let ry = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      const cross = p.x * q.y - q.x * p.y;
      a2 += cross;
      rx += (p.x + q.x) * cross;
      ry += (p.y + q.y) * cross;
    }
    const sign = a2 < 0 ? -1 : 1;
    area2 += a2 * sign;
    cx += rx * sign;
    cy += ry * sign;
  }
  const areaM2 = area2 / 2;
  const centroidLocal = area2 > 0 ? { x: cx / (3 * area2), y: cy / (3 * area2) } : { x: 0, y: 0 };
  const cosLat = Math.cos(rad(approx.lat));
  const centroid = {
    lat: approx.lat + (centroidLocal.y / R) * (180 / Math.PI),
    lng: approx.lng + (centroidLocal.x / (R * cosLat)) * (180 / Math.PI),
  };

  let radiusM = 0;
  let longest = 0;
  let longestEdgeHeading = 0;
  for (const pts of local) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      radiusM = Math.max(radiusM, Math.hypot(p.x - centroidLocal.x, p.y - centroidLocal.y));
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len > longest) {
        longest = len;
        longestEdgeHeading = ((Math.atan2(q.x - p.x, q.y - p.y) * 180) / Math.PI + 360) % 360;
      }
    }
  }
  return { ring: rings[0]!, rings, centroid, areaM2, radiusM, longestEdgeHeading };
}

/** "1.250 m²" biçiminde Türkçe gösterim. */
export const formatArea = (m2: number) => `${Math.round(m2).toLocaleString("tr-TR")} m²`;
