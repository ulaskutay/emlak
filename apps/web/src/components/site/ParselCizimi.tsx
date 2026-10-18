import { parselCizimi } from "@/lib/ornek-parsel";

/** Örnek parselin sınırı: açılışta bir kez çizilir, kenar uzunlukları sonra belirir. */
export function ParselCizimi({ className = "" }: { className?: string }) {
  const { points, kenarlar } = parselCizimi(1000, 90);
  const nums = points.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const cx = nums.reduce((s, p) => s + p[0], 0) / nums.length;
  const cy = nums.reduce((s, p) => s + p[1], 0) / nums.length;

  return (
    <svg viewBox="0 0 1000 1000" className={className} role="img" aria-label="Ezine 230 ada 3 parselin sınırı">
      <polygon points={points} fill="#ffc24d" fillOpacity="0.16" className="parsel-etiket" style={{ animationDelay: "1.2s" }} />
      <polygon
        points={points}
        pathLength={1}
        fill="none"
        stroke="#1e2a23"
        strokeWidth="11"
        strokeLinejoin="round"
        className="parsel-cizgi"
      />
      <polygon
        points={points}
        pathLength={1}
        fill="none"
        stroke="#ffc24d"
        strokeWidth="6"
        strokeLinejoin="round"
        className="parsel-cizgi"
      />
      {nums.slice(0, -1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="#1e2a23" className="parsel-etiket" style={{ animationDelay: `${1.3 + i * 0.05}s` }} />
      ))}
      {kenarlar
        .filter((k) => k.uzunluk >= 30)
        .map((k, i) => {
          const dx = k.x - cx;
          const dy = k.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const x = k.x + (dx / d) * 46;
          const y = k.y + (dy / d) * 46;
          const w = String(k.uzunluk).length * 17 + 46;
          return (
            <g key={i} className="parsel-etiket" style={{ animationDelay: `${1.5 + i * 0.08}s` }}>
              <rect x={x - w / 2} y={y - 21} width={w} height="42" rx="21" fill="#1e2a23" />
              <text
                x={x}
                y={y + 9}
                textAnchor="middle"
                fill="#f7f8f3"
                fontSize="26"
                fontWeight="600"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {k.uzunluk} m
              </text>
            </g>
          );
        })}
    </svg>
  );
}
