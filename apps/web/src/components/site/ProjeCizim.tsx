/**
 * Proje görseli: "Arsadan inşaat videosu" örneğimizin (public/media/sablon-insaat.mp4) gerçek kareleri — boş arsa → kazı →
 * kaba yapı → bitmiş bina (public/media/insaat-1..4.webp) — sırayla belirir. Üstte videodaki gibi imar etiketi, altta aşama adı
 * ve dört parçalı ilerleme; kartın arkasında çizim vinç kancasını indirip kaldırır.
 */
const ASAMALAR = ["Boş arsa", "Kazı ve temel", "Kaba inşaat", "Bitmiş hali"];
const yazi = { paintOrder: "stroke", stroke: "#0d1b3e", strokeWidth: 4, strokeLinejoin: "round" } as const;

export function ProjeCizim({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <clipPath id="pj-kart">
          <rect x="120" y="10" width="400" height="500" rx="28" />
        </clipPath>
        <linearGradient id="pj-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Kartın arkasında çizim vinç: drone ve konut çizimleriyle aynı dil */}
      <g stroke="#f2b705" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M72 500 L72 70" />
        <path d="M30 70 L200 70" />
        <path d="M50 92 L72 70 L94 92" />
        <path d="M72 70 L110 48 L170 70" strokeWidth="3" />
      </g>
      <rect x="28" y="64" width="30" height="16" rx="3" fill="#1b2a52" />
      <g className="proje-kanca">
        <path d="M100 70 L100 150" stroke="#1b2a52" strokeWidth="2.5" />
        <path d="M100 150 c-9 0 -9 14 0 14 c6 0 7 -5 7 -8" stroke="#1b2a52" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>

      <rect x="120" y="10" width="400" height="500" rx="28" fill="#0d1b3e" />
      <g clipPath="url(#pj-kart)">
        {/* Gerçek kareler: her aşama bir öncekinin üstünde belirir */}
        <image href="/media/insaat-1.webp" x="120" y="10" width="400" height="500" preserveAspectRatio="xMidYMid slice" />
        {[2, 3, 4].map((n) => (
          <image key={n} className={`proje-k${n}`} href={`/media/insaat-${n}.webp`} x="120" y="10" width="400" height="500" preserveAspectRatio="xMidYMid slice" />
        ))}

        {/* Videodaki imar etiketi: koyu kutu, sarı şerit */}
        <rect x="140" y="30" width="196" height="54" rx="8" fill="#0d1b3e" opacity="0.82" />
        <rect x="140" y="30" width="5" height="54" rx="2" fill="#ffc93c" />
        <text x="156" y="54" fill="#ffffff" fontSize="18" fontWeight="800" fontFamily="inherit">11.091 m²</text>
        <text x="156" y="73" fill="#ffffff" fontSize="11.5" fontWeight="600" fontFamily="inherit" opacity="0.8">Konut imarlı · Emsal 1,20</text>

        {/* Alt karartma, aşama adı ve dört parçalı ilerleme */}
        <rect x="120" y="340" width="400" height="170" fill="url(#pj-alt)" />
        {ASAMALAR.map((a, i) => (
          <text key={a} className={`proje-a${i + 1}`} x="320" y="458" textAnchor="middle" fill="#ffffff" fontSize="24" fontWeight="800" fontFamily="inherit" style={yazi}>
            {i === 3 ? <tspan fill="#ffd166">{a}</tspan> : a}
          </text>
        ))}
        {ASAMALAR.map((a, i) => (
          <g key={a}>
            <rect x={164 + i * 80} y="476" width="72" height="5" rx="2.5" fill="#ffffff" opacity="0.3" />
            <rect className={i ? `proje-k${i + 1}` : undefined} x={164 + i * 80} y="476" width="72" height="5" rx="2.5" fill="#ffc93c" />
          </g>
        ))}
        <text x="504" y="500" textAnchor="end" fill="#ffffff" fontSize="10" fontFamily="inherit" opacity="0.75">
          Görüntü temsilidir
        </text>
      </g>
    </svg>
  );
}
