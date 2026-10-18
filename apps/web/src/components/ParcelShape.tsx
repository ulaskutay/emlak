/** Parsel sınırının neon çizimi (harita anahtarı gerektirmez). */
export function ParcelShape({ ring, className = "" }: { ring: { lat: number; lng: number }[]; className?: string }) {
  if (ring.length < 3) return null;
  const k = Math.cos((ring[0]!.lat * Math.PI) / 180);
  const pts = ring.map((p) => ({ x: p.lng * k, y: -p.lat }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = 100 / Math.max(maxX - minX, maxY - minY);
  const ox = (100 - (maxX - minX) * s) / 2;
  const oy = (100 - (maxY - minY) * s) / 2;
  const d = pts.map((p) => `${(ox + (p.x - minX) * s).toFixed(2)},${(oy + (p.y - minY) * s).toFixed(2)}`).join(" ");
  return (
    <svg viewBox="-8 -8 116 116" className={className} aria-label="Parsel sınırı">
      <polygon points={d} fill="rgba(255,194,77,.14)" stroke="#ffc24d" strokeWidth="2.2" strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(255,194,77,.7))" }} />
    </svg>
  );
}
