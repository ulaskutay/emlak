/**
 * Konut görseli: "Sunuculu ev turu" videosunun bir karesi gibi. Kendi "Boş evi döşe" videomuzdan gerçek yatak odası
 * (public/media/oda-bos.webp → oda-doseli.webp, belirip kaybolur), odanın içinde Higgsfield sunucu karesi (sunucu-kare.webp),
 * altta videodaki gibi altyazı.
 */
export function KonutCizim({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <clipPath id="kn-kart">
          <rect x="120" y="10" width="400" height="500" rx="28" />
        </clipPath>
        <linearGradient id="kn-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="kn-ayak">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0.35" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="120" y="10" width="400" height="500" rx="28" fill="#0d1b3e" />
      <g clipPath="url(#kn-kart)">
        {/* Oda: boş → döşenmiş */}
        <image href="/media/oda-bos.webp" x="120" y="10" width="400" height="500" preserveAspectRatio="xMidYMid slice" />
        <image className="konut-doseli" href="/media/oda-doseli.webp" x="120" y="10" width="400" height="500" preserveAspectRatio="xMidYMid slice" />

        {/* Sunucu odanın içinde, sağda; ayaklarının altında zemin gölgesi */}
        <ellipse cx="425" cy="500" rx="80" ry="14" fill="url(#kn-ayak)" />
        <image href="/media/sunucu-kare.webp" x="322" y="118" width="200" height="396" preserveAspectRatio="xMidYMax meet" />
        <g fill="#ffffff">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} className="konut-ses" x={356 + i * 8} y="150" width="4.5" height="22" rx="2.25" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </g>

        {/* Alt karartma ve altyazı: videodaki gibi vurgulu kelime */}
        <rect x="120" y="360" width="400" height="150" fill="url(#kn-alt)" />
        <text x="320" y="470" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="800" fontFamily="inherit" style={{ paintOrder: "stroke", stroke: "#0d1b3e", strokeWidth: 4, strokeLinejoin: "round" }}>
          Güney cepheli, <tspan fill="#ffd166">on sekiz metrekare</tspan>
        </text>
        <text x="320" y="494" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="800" fontFamily="inherit" style={{ paintOrder: "stroke", stroke: "#0d1b3e", strokeWidth: 4, strokeLinejoin: "round" }}>
          yatak odası sizi bekliyor.
        </text>

        {/* Oda adı ve döşeme durumu */}
        <rect x="136" y="26" width="118" height="30" rx="15" fill="#0d1b3e" opacity="0.75" />
        <text x="195" y="46" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="inherit">
          Yatak odası
        </text>
        <g className="konut-bos">
          <rect x="412" y="26" width="92" height="30" rx="15" fill="#ffffff" />
          <circle cx="428" cy="41" r="5" fill="#9aa3b5" />
          <text x="440" y="46" fill="#0d1b3e" fontSize="14" fontWeight="700" fontFamily="inherit">
            Boş hali
          </text>
        </g>
        <g className="konut-doseli">
          <rect x="340" y="26" width="164" height="30" rx="15" fill="#ffffff" />
          <circle cx="356" cy="41" r="5" fill="#2fa36b" />
          <text x="368" y="46" fill="#0d1b3e" fontSize="14" fontWeight="700" fontFamily="inherit">
            Sanal eşya döşendi
          </text>
        </g>
        <text x="136" y="500" fill="#ffffff" fontSize="10" fontFamily="inherit" opacity="0.75">
          Temsilî döşeme
        </text>
      </g>
    </svg>
  );
}
