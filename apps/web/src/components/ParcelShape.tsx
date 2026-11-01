/** Parsel sınırlarının neon çizimi (harita anahtarı gerektirmez); yan yana / parçalı arsada her parsel ayrı çokgen. */
export function ParcelShape({ rings, className = "" }: { rings: { lat: number; lng: number }[][]; className?: string }) {
  const all = rings.flat();
  if (all.length < 3) return null;
  const k = Math.cos((all[0]!.lat * Math.PI) / 180);
  const xy = (p: { lat: number; lng: number }) => ({ x: p.lng * k, y: -p.lat });
  const xs = all.map((p) => xy(p).x);
  const ys = all.map((p) => xy(p).y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = 100 / Math.max(maxX - minX, maxY - minY);
  const ox = (100 - (maxX - minX) * s) / 2;
  const oy = (100 - (maxY - minY) * s) / 2;
  return (
    <svg viewBox="-8 -8 116 116" className={className} aria-label={rings.length > 1 ? `${rings.length} parselin sınırı` : "Parsel sınırı"}>
      {rings.map((ring, i) => (
        <polygon key={i} fill="rgba(255,194,77,.14)" stroke="#ffc24d" strokeWidth="2.2" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(255,194,77,.7))" }}
          points={ring.map(xy).map((p) => `${(ox + (p.x - minX) * s).toFixed(2)},${(oy + (p.y - minY) * s).toFixed(2)}`).join(" ")} />
      ))}
    </svg>
  );
}
