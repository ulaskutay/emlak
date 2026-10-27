/**
 * Konut görseli: kendi "Boş evi döşe" videomuzdan gerçek yatak odası kareleri (public/media/oda-bos.webp, oda-doseli.webp).
 * Döşenmiş hali boş odanın üstünde belirip kaybolur; sağ önde Higgsfield sunucu karesi (sunucu-kare.webp) anlatır.
 */
export function KonutCizim({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <clipPath id="kn-kart">
          <rect x="80" y="10" width="370" height="500" rx="28" />
        </clipPath>
        <linearGradient id="kn-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Video karesi: gerçek oda, boş → döşenmiş */}
      <rect x="80" y="10" width="370" height="500" rx="28" fill="#0d1b3e" />
      <g clipPath="url(#kn-kart)">
        <image href="/media/oda-bos.webp" x="80" y="10" width="370" height="500" preserveAspectRatio="xMidYMid slice" />
        <image className="konut-doseli" href="/media/oda-doseli.webp" x="80" y="10" width="370" height="500" preserveAspectRatio="xMidYMid slice" />
        <rect x="80" y="380" width="370" height="130" fill="url(#kn-alt)" />

        {/* Oda adı */}
        <rect x="96" y="26" width="118" height="30" rx="15" fill="#0d1b3e" opacity="0.75" />
        <text x="155" y="46" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="inherit">
          Yatak odası
        </text>

        {/* Durum etiketi: boş / döşendi */}
        <g className="konut-bos">
          <rect x="96" y="454" width="92" height="30" rx="15" fill="#ffffff" />
          <circle cx="112" cy="469" r="5" fill="#9aa3b5" />
          <text x="124" y="474" fill="#0d1b3e" fontSize="14" fontWeight="700" fontFamily="inherit">
            Boş hali
          </text>
        </g>
        <g className="konut-doseli">
          <rect x="96" y="454" width="160" height="30" rx="15" fill="#ffffff" />
          <circle cx="112" cy="469" r="5" fill="#2fa36b" />
          <text x="124" y="474" fill="#0d1b3e" fontSize="14" fontWeight="700" fontFamily="inherit">
            Sanal döşeme hazır
          </text>
        </g>
        <text x="434" y="498" textAnchor="end" fill="#ffffff" fontSize="10" fontFamily="inherit" opacity="0.8">
          Temsilî döşeme
        </text>
      </g>

      {/* Sunucu: kartın önünde, konuşurken ses dalgası */}
      <ellipse cx="506" cy="508" rx="88" ry="8" fill="#0d1b3e" opacity="0.2" />
      <image href="/media/sunucu-kare.webp" x="404" y="162" width="178" height="350" preserveAspectRatio="xMidYMax meet" />
      <g fill="#2b6cff">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} className="konut-ses" x={428 + i * 9} y="184" width="5" height="26" rx="2.5" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>
    </svg>
  );
}
