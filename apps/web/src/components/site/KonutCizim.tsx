/**
 * Çizim konut: boş bir salon sırayla döşenir (halı, koltuk, sehpa, lamba, bitki, tablo); sağ önde gerçek sunucu karesi anlatır.
 * Eşyalar `konut-esya` ile sırayla belirir, döngü başında kaybolup yeniden döşenir.
 */
const ESYA_GECIKME = [0, 0.7, 1.4, 2.1, 2.8, 3.5];

function Esya({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <g className="konut-esya" style={{ animationDelay: `${ESYA_GECIKME[i]}s` }}>
      {children}
    </g>
  );
}

export function KonutCizim({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <linearGradient id="kn-duvar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f8fb" />
          <stop offset="1" stopColor="#e9edf4" />
        </linearGradient>
        <linearGradient id="kn-zemin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9dfe9" />
          <stop offset="1" stopColor="#c3c9d6" />
        </linearGradient>
        <linearGradient id="kn-gok" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fb8ff" />
          <stop offset="1" stopColor="#dfeaff" />
        </linearGradient>
        <linearGradient id="kn-koltuk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a7dff" />
          <stop offset="1" stopColor="#2451c7" />
        </linearGradient>
        <linearGradient id="kn-hali" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
        <radialGradient id="kn-lamba-isik">
          <stop offset="0" stopColor="#ffd166" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd166" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kn-ceket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3a6b" />
          <stop offset="1" stopColor="#0d1b3e" />
        </linearGradient>
      </defs>

      {/* Oda: arka duvar, zemin, süpürgelik */}
      <rect x="60" y="50" width="520" height="300" rx="6" fill="url(#kn-duvar)" />
      <path d="M60 350 L580 350 L640 500 L0 500 Z" fill="url(#kn-zemin)" />
      <path d="M60 350 L580 350" stroke="#ffffff" strokeWidth="6" opacity="0.8" />
      <g stroke="#ffffff" strokeWidth="1.5" opacity="0.5">
        <path d="M190 350 L120 500" />
        <path d="M320 350 L320 500" />
        <path d="M450 350 L520 500" />
      </g>

      {/* Pencere */}
      <rect x="360" y="90" width="170" height="160" rx="8" fill="#ffffff" />
      <rect x="370" y="100" width="150" height="140" rx="4" fill="url(#kn-gok)" />
      <path d="M445 100 L445 240 M370 170 L520 170" stroke="#ffffff" strokeWidth="6" />
      <circle cx="400" cy="130" r="12" fill="#ffffff" opacity="0.8" />
      <circle cx="414" cy="136" r="9" fill="#ffffff" opacity="0.8" />
      {/* Pencereden düşen ışık */}
      <path d="M370 240 L520 240 L600 500 L300 500 Z" fill="#ffffff" opacity="0.22" />

      {/* Döşeme: sırayla beliren eşyalar */}
      <Esya i={0}>
        <ellipse cx="300" cy="440" rx="190" ry="42" fill="url(#kn-hali)" />
        <ellipse cx="300" cy="440" rx="160" ry="30" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      </Esya>
      <Esya i={1}>
        {/* Koltuk */}
        <rect x="150" y="262" width="260" height="34" rx="14" fill="#2451c7" />
        <rect x="140" y="290" width="280" height="70" rx="18" fill="url(#kn-koltuk)" />
        <rect x="156" y="296" width="118" height="44" rx="12" fill="#5d8bff" />
        <rect x="286" y="296" width="118" height="44" rx="12" fill="#5d8bff" />
        <rect x="128" y="300" width="28" height="56" rx="12" fill="#2451c7" />
        <rect x="404" y="300" width="28" height="56" rx="12" fill="#2451c7" />
        <g fill="#1b2a52">
          <rect x="154" y="358" width="10" height="14" rx="3" />
          <rect x="396" y="358" width="10" height="14" rx="3" />
        </g>
      </Esya>
      <Esya i={2}>
        {/* Sehpa */}
        <ellipse cx="300" cy="418" rx="58" ry="18" fill="#ffffff" />
        <ellipse cx="300" cy="414" rx="58" ry="18" fill="#f1f3f7" stroke="#c3c9d6" strokeWidth="1.5" />
        <path d="M262 428 L258 446 M338 428 L342 446" stroke="#6b7488" strokeWidth="4" strokeLinecap="round" />
        <rect x="286" y="402" width="28" height="8" rx="2" fill="#2b6cff" />
      </Esya>
      <Esya i={3}>
        {/* Lambader */}
        <circle cx="325" cy="236" r="70" fill="url(#kn-lamba-isik)" />
        <path d="M325 248 L325 300" stroke="#1b2a52" strokeWidth="5" strokeLinecap="round" />
        <path d="M295 250 L355 250 L343 206 L307 206 Z" fill="#ffffff" stroke="#c3c9d6" strokeWidth="2" />
        <path d="M299 250 L351 250" stroke="#ffd166" strokeWidth="4" />
      </Esya>
      <Esya i={4}>
        {/* Bitki */}
        <path d="M86 330 L130 330 L124 372 L92 372 Z" fill="#ff6b4a" />
        <path d="M86 330 L130 330" stroke="#ffffff" strokeWidth="4" />
        <g fill="#2fa36b">
          <ellipse cx="108" cy="296" rx="12" ry="30" />
          <ellipse cx="86" cy="304" rx="11" ry="26" transform="rotate(-30 86 304)" />
          <ellipse cx="130" cy="304" rx="11" ry="26" transform="rotate(30 130 304)" />
          <ellipse cx="96" cy="318" rx="9" ry="20" transform="rotate(-60 96 318)" />
          <ellipse cx="120" cy="318" rx="9" ry="20" transform="rotate(60 120 318)" />
        </g>
      </Esya>
      <Esya i={5}>
        {/* Tablo */}
        <rect x="150" y="110" width="140" height="100" rx="6" fill="#ffffff" stroke="#c3c9d6" strokeWidth="2" />
        <rect x="162" y="122" width="116" height="76" rx="3" fill="#dfeaff" />
        <path d="M162 198 L200 158 L224 180 L246 150 L278 198 Z" fill="#2b6cff" opacity="0.7" />
        <circle cx="254" cy="140" r="9" fill="#ffd166" />
      </Esya>

      {/* Sunucu: Higgsfield'da ürettiğimiz sunucu görselinden kesilmiş kare (public/media/sunucu-kare.webp), konuşurken ses dalgası */}
      <ellipse cx="548" cy="496" rx="88" ry="9" fill="#0d1b3e" opacity="0.18" />
      <image href="/media/sunucu-kare.webp" x="452" y="150" width="178" height="350" preserveAspectRatio="xMidYMax meet" />
      <g fill="#2b6cff">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} className="konut-ses" x={478 + i * 9} y="174" width="5" height="26" rx="2.5" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>

      {/* Altyazı */}
      <rect x="80" y="466" width="300" height="34" rx="17" fill="#0d1b3e" opacity="0.9" />
      <text x="230" y="489" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" fontFamily="inherit">
        Salon, güney cephe, 32 m²
      </text>
    </svg>
  );
}
