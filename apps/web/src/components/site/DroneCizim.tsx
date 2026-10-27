/**
 * Çizim drone: 3/4 üstten bakış, katlanır kollu kamera drone'u; altında gerçek parsel karesi. Pervaneler perspektifte döner, gövde süzülür.
 * Katman sırası: arka pervaneler → arka kollar → gövde → ön kollar → ön pervaneler → gimbal.
 */
type Motor = { x: number; y: number; arka: boolean; isik: string };

const MOTORLAR: Motor[] = [
  { x: 214, y: 150, arka: true, isik: "#ff5a4a" },
  { x: 426, y: 150, arka: true, isik: "#ff5a4a" },
  { x: 164, y: 262, arka: false, isik: "#43d17a" },
  { x: 476, y: 262, arka: false, isik: "#43d17a" },
];

function Pervane({ x, y, i }: { x: number; y: number; i: number }) {
  const blade = "M0 0 C12 -9 62 -11 88 -3 L88 3 C62 9 12 7 0 0 Z";
  return (
    <g transform={`translate(${x} ${y}) scale(1 0.34)`}>
      <circle r="90" fill="url(#dr-disk)" />
      <circle r="90" fill="none" stroke="#1f2638" strokeWidth="2" opacity="0.22" />
      <g className="drone-pervane" style={{ animationDelay: `${i * -0.045}s` }}>
        <path d={blade} fill="url(#dr-kanat)" />
        <path d={blade} fill="url(#dr-kanat)" transform="rotate(180)" />
      </g>
    </g>
  );
}

function Motorr({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 13} y={y - 4} width="26" height="18" rx="4" fill="url(#dr-motor-yan)" />
      <ellipse cx={x} cy={y + 14} rx="13" ry="5" fill="#1a2030" />
      <ellipse cx={x} cy={y - 4} rx="13" ry="5" fill="url(#dr-motor-ust)" />
      <ellipse cx={x} cy={y - 4} rx="5" ry="2" fill="#0f1420" />
    </g>
  );
}

function Kol({ d, ust }: { d: string; ust: string }) {
  return (
    <g>
      <path d={d} stroke="#1f2638" strokeWidth="19" strokeLinecap="round" fill="none" />
      <path d={d} stroke="url(#dr-kol)" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d={ust} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35" />
    </g>
  );
}

export function DroneCizim({ className = "" }: { className?: string }) {
  const arka = MOTORLAR.filter((m) => m.arka);
  const on = MOTORLAR.filter((m) => !m.arka);
  return (
    <div className={`relative aspect-[640/612] ${className}`} aria-hidden>
      {/* Zemin: kendi drone videomuzdan parsel karesi; ayrı katman, animasyonsuz */}
      <div className="absolute top-[60.9%] left-[12.3%] h-[38.7%] w-[69.4%] overflow-hidden rounded-[6%] border-[3px] border-white bg-lacivert shadow-[0_20px_40px_-24px_rgba(13,27,62,.6)] sm:border-4">
        <img src="/media/arsa-zemin.webp" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="drone-golge absolute top-[75.3%] left-[31.25%] h-[4.6%] w-[37.5%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(13,27,62,.35),transparent)]" />
      <svg viewBox="0 0 640 612" className="drone-suzul absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="dr-ust" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e3e7ef" />
          <stop offset="1" stopColor="#c3c9d6" />
        </linearGradient>
        <linearGradient id="dr-on" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aab2c2" />
          <stop offset="1" stopColor="#6b7488" />
        </linearGradient>
        <linearGradient id="dr-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a6378" />
          <stop offset="1" stopColor="#3a4254" />
        </linearGradient>
        <linearGradient id="dr-kol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#59627a" />
          <stop offset="1" stopColor="#2a3040" />
        </linearGradient>
        <linearGradient id="dr-motor-yan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2b3242" />
          <stop offset="0.5" stopColor="#4a5368" />
          <stop offset="1" stopColor="#1f2534" />
        </linearGradient>
        <linearGradient id="dr-motor-ust" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b7488" />
          <stop offset="1" stopColor="#2f3646" />
        </linearGradient>
        <linearGradient id="dr-kanat" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a3040" />
          <stop offset="1" stopColor="#6d778d" />
        </linearGradient>
        <radialGradient id="dr-disk">
          <stop offset="0.6" stopColor="#2b6cff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#2b6cff" stopOpacity="0.16" />
        </radialGradient>
        <radialGradient id="dr-lens" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#7aa6ff" />
          <stop offset="0.35" stopColor="#1b3d8f" />
          <stop offset="0.8" stopColor="#070c1a" />
          <stop offset="1" stopColor="#000000" />
        </radialGradient>
        <radialGradient id="dr-golge">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0.3" />
          <stop offset="0.7" stopColor="#0d1b3e" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dr-isin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b6cff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2b6cff" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id="dr-isik-kirmizi">
          <stop offset="0" stopColor="#ff5a4a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff5a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dr-isik-yesil">
          <stop offset="0" stopColor="#43d17a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#43d17a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g>
        {/* Arka pervaneler ve kollar (gövdenin arkasında kalır) */}
        {arka.map((m, i) => (
          <Pervane key={i} x={m.x} y={m.y} i={i} />
        ))}
        <Kol d="M262 204 L214 152" ust="M266 198 L222 150" />
        <Kol d="M378 204 L426 152" ust="M374 198 L418 150" />
        {arka.map((m, i) => (
          <Motorr key={i} x={m.x} y={m.y} />
        ))}

        {/* Gövde: üst yüz, ön yüz, alt gölge */}
        <path d="M244 266 Q320 292 396 266 L402 246 Q320 270 238 246 Z" fill="url(#dr-alt)" />
        <path d="M236 240 Q320 262 404 240 L400 262 Q320 288 240 262 Z" fill="url(#dr-on)" />
        <path d="M252 198 Q320 180 388 198 L404 240 Q320 262 236 240 Z" fill="url(#dr-ust)" />
        {/* Üst yüz detayları: havalandırma, kapak çizgisi, marka şeridi */}
        <path d="M268 214 Q320 204 372 214" stroke="#9aa3b5" strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M262 230 Q320 244 378 230" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" />
        <path d="M236 240 Q320 262 404 240" stroke="#2b6cff" strokeWidth="3" fill="none" opacity="0.9" />
        <g fill="#2f3646" opacity="0.55">
          <rect x="286" y="202" width="18" height="3" rx="1.5" />
          <rect x="310" y="200" width="18" height="3" rx="1.5" />
          <rect x="334" y="202" width="18" height="3" rx="1.5" />
        </g>
        {/* Ön sensörler */}
        <circle cx="282" cy="250" r="5" fill="#0f1420" />
        <circle cx="358" cy="250" r="5" fill="#0f1420" />
        <circle cx="280" cy="248" r="1.5" fill="#ffffff" opacity="0.7" />
        <circle cx="356" cy="248" r="1.5" fill="#ffffff" opacity="0.7" />

        {/* Ön kollar */}
        <Kol d="M246 248 L166 262" ust="M248 242 L172 256" />
        <Kol d="M394 248 L474 262" ust="M392 242 L468 256" />
        {on.map((m, i) => (
          <Motorr key={i} x={m.x} y={m.y} />
        ))}

        {/* Seyir ışıkları: arkada kırmızı, önde yeşil */}
        {MOTORLAR.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y + 8} r="9" fill={`url(#${m.arka ? "dr-isik-kirmizi" : "dr-isik-yesil"})`} className="drone-isik" />
            <circle cx={m.x} cy={m.y + 8} r="2.2" fill="#ffffff" opacity="0.9" />
          </g>
        ))}

        {/* Ön pervaneler (gövdenin önünde) */}
        {on.map((m, i) => (
          <Pervane key={i} x={m.x} y={m.y} i={i + 2} />
        ))}

        {/* Kamera ışını: lensten parsele doğru açılan koni ve tarayan çizgi */}
        <path className="drone-isin" d="M312 322 L262 475 L378 475 L328 322 Z" fill="url(#dr-isin)" />
        <line className="drone-tarama" x1="262" y1="400" x2="378" y2="400" stroke="#ffffff" strokeWidth="2" opacity="0.8" />

        {/* Gimbal kamera */}
        <rect x="308" y="278" width="24" height="14" rx="4" fill="#1f2638" />
        <path d="M300 288 L340 288 L336 300 L304 300 Z" fill="#2f3646" />
        <circle cx="320" cy="312" r="21" fill="#1a2030" />
        <circle cx="320" cy="312" r="18" fill="#2b3242" />
        <circle cx="320" cy="312" r="13.5" fill="url(#dr-lens)" />
        <circle cx="320" cy="312" r="13.5" fill="none" stroke="#5a6378" strokeWidth="1.5" />
        <circle cx="314" cy="306" r="2.5" fill="#ffffff" opacity="0.85" />
        <circle cx="325" cy="318" r="1.2" fill="#ffffff" opacity="0.5" />
      </g>
      </svg>
    </div>
  );
}
