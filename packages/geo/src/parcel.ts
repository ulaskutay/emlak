import type { LatLng } from "./kml.js";

const R = 6_378_137; // WGS84 ekvator yarıçapı (m)
const rad = (d: number) => (d * Math.PI) / 180;

/** Halkayı merkez etrafında yerel düzleme (metre) izdüşürür; parsel ölçeğinde hata ihmal edilebilir. */
function toLocal(ring: LatLng[], origin: LatLng): { x: number; y: number }[] {
  const cosLat = Math.cos(rad(origin.lat));
  return ring.map((p) => ({ x: rad(p.lng - origin.lng) * R * cosLat, y: rad(p.lat - origin.lat) * R }));
}

export interface ParcelGeometry {
  ring: LatLng[];
  centroid: LatLng;
  areaM2: number;
  /** Merkezden en uzak köşeye mesafe (m) — kamera mesafesini belirlemek için. */
  radiusM: number;
  /** En uzun kenarın pusula yönü (derece) — kamerayı parsele hizalamak için. */
  longestEdgeHeading: number;
}

export function analyzeParcel(ring: LatLng[]): ParcelGeometry {
  const approx = {
    lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length,
    lng: ring.reduce((s, p) => s + p.lng, 0) / ring.length,
  };
  const pts = toLocal(ring, approx);

  // Shoelace: alan ve alan ağırlıklı ağırlık merkezi
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  const areaM2 = Math.abs(a2) / 2;
  const centroidLocal = { x: cx / (3 * a2), y: cy / (3 * a2) };
  const cosLat = Math.cos(rad(approx.lat));
  const centroid = {
    lat: approx.lat + (centroidLocal.y / R) * (180 / Math.PI),
    lng: approx.lng + (centroidLocal.x / (R * cosLat)) * (180 / Math.PI),
  };

  let radiusM = 0;
  let longest = 0;
  let longestEdgeHeading = 0;
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
  return { ring, centroid, areaM2, radiusM, longestEdgeHeading };
}

/** "1.250 m²" biçiminde Türkçe gösterim. */
export const formatArea = (m2: number) => `${Math.round(m2).toLocaleString("tr-TR")} m²`;
