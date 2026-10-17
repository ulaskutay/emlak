/**
 * Motorlardan bağımsız sahne geometrisi (parsel merkezli yerel metrik düzlem: x doğu, y kuzey, metre).
 * Google ve Cesium motorları aynı çizgileri/çokgenleri buradan alır, yalnızca kendi nesnelerine çevirir.
 *
 *   kısmi çizim    halka uzunluk boyunca p oranında (neon kontur, mahalle sınırı)
 *   tarama         tarama ekseni u (en uzun kenar yönü), taranan bölge, tarama çizgisi, ızgara (parsele kırpılmış)
 *   kenarlar       kenar ortaları ve uzunlukları
 */
import type { ParcelInfo } from "./types.js";

export type XY = { x: number; y: number };
export type LL = { lat: number; lng: number };

const dot = (a: XY, b: XY) => a.x * b.x + a.y * b.y;

export function makeGeometry(parcel: ParcelInfo) {
  const c = parcel.centroid;
  const K = Math.cos((c.lat * Math.PI) / 180);
  const toXY = (q: LL): XY => ({ x: (q.lng - c.lng) * 111_320 * K, y: (q.lat - c.lat) * 111_320 });
  const toLL = (q: XY): LL => ({ lat: c.lat + q.y / 111_320, lng: c.lng + q.x / (111_320 * K) });

  const ringXY = parcel.ring.map(toXY);
  const h = (parcel.longestEdgeHeading * Math.PI) / 180;
  const axisU = { x: Math.sin(h), y: Math.cos(h) };
  const axisV = { x: Math.cos(h), y: -Math.sin(h) };
  const us = ringXY.map((q) => dot(q, axisU));
  const [uMin, uMax] = [Math.min(...us), Math.max(...us)];
  const vs = ringXY.map((q) => dot(q, axisV));
  const extent = Math.max(uMax - uMin, Math.max(...vs) - Math.min(...vs));
  // Yuvarlak ızgara aralığı: 5, 10, 20, 25, 50 m (parsel başına ~10–14 çizgi).
  const gridStep = [5, 10, 20, 25, 50, 100].find((s) => extent / s <= 14) ?? 100;

  /** Sutherland–Hodgman: çokgenin u ≥ cut yarı düzlemindeki kısmı. */
  function clipAbove(poly: XY[], cut: number): XY[] {
    const out: XY[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ua = dot(a, axisU) - cut;
      const ub = dot(b, axisU) - cut;
      if (ua >= 0) out.push(a);
      if (ua >= 0 !== ub >= 0) {
        const t = ua / (ua - ub);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  }

  /** Çokgen ile "axis · q = k" doğrusunun kesişimi: en dış iki nokta (içbükey parsellerde yaklaşık). */
  function chord(poly: XY[], axis: XY, k: number): [XY, XY] | null {
    const hits: XY[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ua = dot(a, axis) - k;
      const ub = dot(b, axis) - k;
      if (ua >= 0 !== ub >= 0) {
        const t = ua / (ua - ub);
        hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (hits.length < 2) return null;
    const other = axis === axisU ? axisV : axisU;
    hits.sort((p, q) => dot(p, other) - dot(q, other));
    return [hits[0]!, hits[hits.length - 1]!];
  }

  /** Taramanın bir anı (progress 0..1): ekranın üstünden (uzak uç) alta. */
  function scanFrame(progress: number) {
    const cut = uMax - (uMax - uMin) * Math.max(0, Math.min(1, progress));
    const scanned = clipAbove(ringXY, cut);
    const line = chord(ringXY, axisU, Math.min(uMax - 0.01, Math.max(uMin + 0.01, cut)));
    const grid: [XY, XY][] = [];
    for (let u = Math.ceil(uMin / gridStep) * gridStep; u <= uMax; u += gridStep) {
      if (u < cut) continue;
      const ch = chord(ringXY, axisU, u);
      if (ch) grid.push(ch);
    }
    if (scanned.length > 2) {
      const sv = scanned.map((q) => dot(q, axisV));
      for (let v = Math.ceil(Math.min(...sv) / gridStep) * gridStep; v <= Math.max(...sv); v += gridStep) {
        const ch = chord(scanned, axisV, v);
        if (ch) grid.push(ch);
      }
    }
    return { scanned: scanned.length > 2 ? scanned : [], line, grid };
  }

  /** En fazla kaç ızgara çizgisi olabilir (nesne havuzu boyutu). */
  const gridMax = Math.ceil((uMax - uMin) / gridStep) + Math.ceil(extent / gridStep) + 4;

  /** Halkayı (kapalı) uzunluk boyunca p oranında çizen yol. */
  function progressive(ring: LL[]) {
    const pts = [...ring, ring[0]!];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = toXY(pts[i - 1]!);
      const b = toXY(pts[i]!);
      cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    return (p: number): LL[] => {
      const target = cum[cum.length - 1]! * Math.max(0, Math.min(1, p));
      const out = [pts[0]!];
      for (let i = 1; i < pts.length; i++) {
        if (cum[i]! <= target) {
          out.push(pts[i]!);
          continue;
        }
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const t = (target - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1);
        out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
        break;
      }
      return out.length > 1 ? out : [pts[0]!, pts[0]!];
    };
  }

  /** 8 m'den uzun kenarlar (en uzun 8): orta nokta ve uzunluk. */
  const edges = parcel.ring
    .map((a, i) => {
      const b = parcel.ring[(i + 1) % parcel.ring.length]!;
      const [pa, pb] = [toXY(a), toXY(b)];
      return { mid: toLL({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }), len: Math.hypot(pb.x - pa.x, pb.y - pa.y) };
    })
    .filter((e) => e.len >= 8)
    .sort((a, b) => b.len - a.len)
    .slice(0, 8);

  /** Parsel merkezli çember (pin dalga halkası). */
  const circle = (radius: number, n = 48): LL[] =>
    Array.from({ length: n + 1 }, (_, i) => toLL({ x: Math.cos((i / n) * Math.PI * 2) * radius, y: Math.sin((i / n) * Math.PI * 2) * radius }));

  return {
    toXY,
    toLL,
    ringXY,
    scanFrame,
    gridMax,
    parcelPath: progressive(parcel.ring),
    hoodPath: parcel.hood?.ring.length ? progressive(parcel.hood.ring) : null,
    edges,
    circle,
  };
}
export type Geometry = ReturnType<typeof makeGeometry>;

/**
 * Canvas'ta çizilmiş etiket görseli (sayfanın fontu/emojileri). stem verilirse altta sap + nokta (pin):
 * görselin alt ortası konuma oturur.
 */
export function labelCanvas(text: string, color: string, o: { size?: number; stem?: number; bg?: string } = {}) {
  const size = o.size ?? 40;
  const font = `800 ${size}px Inter, system-ui, sans-serif`;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + size * 1.1;
  const h = Math.round(size * 1.7);
  const stem = o.stem ?? 0;
  const dotR = stem ? 13 : 0;
  c.width = w + 8;
  c.height = h + stem + dotR * 2 + 6;
  ctx.fillStyle = o.bg ?? "rgba(20, 12, 6, 0.88)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(4, 3, w, h - 4, h / 3);
  ctx.fill();
  ctx.stroke();
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, h / 2 + 1);
  if (stem) {
    ctx.fillStyle = color;
    ctx.fillRect(c.width / 2 - 3, h - 2, 6, stem);
    ctx.beginPath();
    ctx.arc(c.width / 2, h + stem + dotR, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
  return c;
}

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};
