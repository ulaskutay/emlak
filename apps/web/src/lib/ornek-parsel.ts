/**
 * Sitede gösterilen gerçek örnek parsel (assets/parcels/ezine-230-ada-3.geojson).
 * Videodaki parsel ile aynı; sınır çizimi ve kenar uzunlukları buradan üretilir.
 */
export const ornekParsel = {
  il: "Çanakkale",
  ilce: "Ezine",
  mahalle: "Dalyan",
  mevkii: "Boztepe",
  ada: "230",
  parsel: "3",
  alanM2: 11091.37,
  nitelik: "Zeytinlik",
  ring: [
    [26.15702, 39.76637],
    [26.15545, 39.76728],
    [26.15533, 39.76691],
    [26.15511, 39.76631],
    [26.155, 39.76582],
    [26.15555, 39.7661],
    [26.15656, 39.7664],
    [26.15702, 39.76637],
  ] as [number, number][],
  /** Videodaki çevre bilgisi. */
  cevre: [
    { ad: "Denize", deger: "290 m" },
    { ad: "Dalyan köy merkezine", deger: "790 m" },
    { ad: "Ezine'ye", deger: "16 km" },
  ],
};

const R = 6_371_000;

/** Parseli verilen kutuya sığdırılmış SVG noktaları ve kenar uzunlukları (metre). */
export function parselCizimi(size = 1000, pad = 60) {
  const ring = ornekParsel.ring;
  const lat0 = (ring[0]![1] * Math.PI) / 180;
  const m = ring.map(([lng, lat]) => ({
    x: ((lng * Math.PI) / 180) * Math.cos(lat0) * R,
    y: -((lat * Math.PI) / 180) * R,
  }));
  const xs = m.map((p) => p.x);
  const ys = m.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = (size - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const ox = (size - (maxX - minX) * s) / 2;
  const oy = (size - (maxY - minY) * s) / 2;
  const pts = m.map((p) => ({ x: ox + (p.x - minX) * s, y: oy + (p.y - minY) * s }));
  const kenarlar = m.slice(1).map((p, i) => {
    const a = m[i]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    return { uzunluk: Math.round(Math.hypot(p.x - a.x, p.y - a.y)), x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  });
  return { points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "), kenarlar };
}

export const alanYazi = (m2: number) =>
  `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(m2)} m²`;
