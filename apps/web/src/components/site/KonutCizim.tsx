/**
 * Çizim konut: boş bir salon sırayla döşenir (halı, koltuk, sehpa, lamba, bitki, tablo), köşede sunucu anlatır.
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
        <circle cx="470" cy="236" r="70" fill="url(#kn-lamba-isik)" />
        <path d="M470 248 L470 360" stroke="#1b2a52" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="470" cy="364" rx="24" ry="6" fill="#1b2a52" />
        <path d="M440 250 L500 250 L488 206 L452 206 Z" fill="#ffffff" stroke="#c3c9d6" strokeWidth="2" />
        <path d="M444 250 L496 250" stroke="#ffd166" strokeWidth="4" />
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

      {/* Sunucu: sağ önde, konuşurken ses dalgası */}
      <g>
        <path d="M520 500 C520 440 560 420 580 420 C600 420 640 440 640 500 Z" fill="url(#kn-ceket)" />
        <path d="M566 430 L580 468 L594 430 Z" fill="#ffffff" />
        <path d="M576 420 L584 420 L580 440 Z" fill="#ff6b4a" />
        <circle cx="580" cy="390" r="30" fill="#f1c9a5" />
        <path d="M550 384 C552 352 608 352 610 384 L610 376 C606 346 554 346 550 376 Z" fill="#3a2a1f" />
        <circle cx="570" cy="392" r="2.5" fill="#1b2a52" />
        <circle cx="590" cy="392" r="2.5" fill="#1b2a52" />
        <path d="M572 404 Q580 410 588 404" stroke="#b6563c" strokeWidth="2" strokeLinecap="round" fill="none" />
        <g fill="#2b6cff">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} className="konut-ses" x={500 + i * 9} y="370" width="5" height="26" rx="2.5" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </g>
      </g>

      {/* Altyazı */}
      <rect x="150" y="466" width="300" height="34" rx="17" fill="#0d1b3e" opacity="0.9" />
      <text x="300" y="489" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" fontFamily="inherit">
        Salon, güney cephe, 32 m²
      </text>
    </svg>
  );
}
