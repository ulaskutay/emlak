/**
 * Çizim proje: sarı sınırlı boş arsadan bina kat kat yükselir (hızlandırılmış inşaat), yanda vinç kancasını indirip kaldırır.
 * Katlar `proje-kat` ile alttan büyür; döngü sonunda bina kaybolup yeniden yükselir.
 */
const KAT_SAYISI = 4;
const KAT_YUK = 68;
const TABAN_Y = 400;

function Kat({ i }: { i: number }) {
  const y = TABAN_Y - KAT_YUK * (i + 1);
  const x = 210;
  const w = 180;
  const d = 56; // sağ yüzün derinliği
  return (
    <g className="proje-kat" style={{ animationDelay: `${i * 0.55}s` }}>
      {/* Ön yüz */}
      <rect x={x} y={y} width={w} height={KAT_YUK} fill="url(#pj-on)" />
      {/* Sağ yüz */}
      <path d={`M${x + w} ${y} L${x + w + d} ${y - d / 2} L${x + w + d} ${y + KAT_YUK - d / 2} L${x + w} ${y + KAT_YUK} Z`} fill="url(#pj-yan)" />
      {/* Kat çizgisi */}
      <path d={`M${x} ${y + KAT_YUK} L${x + w} ${y + KAT_YUK} L${x + w + d} ${y + KAT_YUK - d / 2}`} stroke="#9aa3b5" strokeWidth="1.5" fill="none" />
      {/* Ön pencereler */}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={x + 18 + k * 52} y={y + 16} width="36" height="34" rx="3" fill="#2b6cff" opacity="0.8" />
      ))}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={x + 18 + k * 52} y={y + 16} width="36" height="12" rx="3" fill="#ffffff" opacity="0.35" />
      ))}
      {/* Yan pencereler */}
      {[0, 1].map((k) => (
        <path
          key={k}
          d={`M${x + w + 10 + k * 22} ${y + 12 - (10 + k * 22) / 2} l14 -7 v34 l-14 7 Z`}
          fill="#1b3d8f"
          opacity="0.8"
        />
      ))}
    </g>
  );
}

export function ProjeCizim({ className = "" }: { className?: string }) {
  const catY = TABAN_Y - KAT_YUK * KAT_SAYISI;
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <linearGradient id="pj-on" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6fa" />
          <stop offset="1" stopColor="#dde2eb" />
        </linearGradient>
        <linearGradient id="pj-yan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b9c0d0" />
          <stop offset="1" stopColor="#8f98ab" />
        </linearGradient>
        <linearGradient id="pj-cati" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3e7ef" />
          <stop offset="1" stopColor="#c3c9d6" />
        </linearGradient>
        <radialGradient id="pj-golge">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Zemin ve parsel sınırı (drone çizimiyle aynı dil) */}
      <ellipse cx="330" cy="455" rx="230" ry="26" fill="url(#pj-golge)" />
      <g stroke="#c3c9d6" strokeWidth="1.5" opacity="0.6" fill="none">
        <path d="M60 480 L600 480" />
        <path d="M100 452 L560 452" />
      </g>
      <path d="M140 430 L470 404 L560 462 L190 492 Z" fill="#ffd166" fillOpacity="0.16" stroke="#f2b705" strokeWidth="3" strokeLinejoin="round" />
      {[
        [140, 430],
        [470, 404],
        [560, 462],
        [190, 492],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="#ffffff" stroke="#f2b705" strokeWidth="2.5" />
      ))}

      {/* Vinç */}
      <g stroke="#f2b705" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M118 440 L118 96" />
        <path d="M60 96 L380 96" />
        <path d="M96 118 L118 96 L140 118" />
        <path d="M118 96 L200 70 L320 96" strokeWidth="3" />
      </g>
      <rect x="62" y="90" width="40" height="18" rx="3" fill="#1b2a52" />
      <rect x="104" y="420" width="28" height="22" rx="3" fill="#1b2a52" />
      <g className="proje-kanca">
        <path d="M330 96 L330 160" stroke="#1b2a52" strokeWidth="2.5" />
        <path d="M330 160 c-9 0 -9 14 0 14 c6 0 7 -5 7 -8" stroke="#1b2a52" strokeWidth="4" strokeLinecap="round" fill="none" />
        <rect x="314" y="176" width="32" height="20" rx="3" fill="#ff6b4a" />
      </g>

      {/* Bina: zemin plakası sabit, katlar sırayla yükselir, çatı en son */}
      <path d="M200 404 L400 404 L456 376 L256 376 Z" fill="#9aa3b5" />
      {Array.from({ length: KAT_SAYISI }, (_, i) => (
        <Kat key={i} i={i} />
      ))}
      <g className="proje-kat" style={{ animationDelay: `${KAT_SAYISI * 0.55}s` }}>
        <path d={`M210 ${catY} L390 ${catY} L446 ${catY - 28} L266 ${catY - 28} Z`} fill="url(#pj-cati)" />
        <rect x="300" y={catY - 48} width="22" height="22" fill="#6b7488" />
        <path d={`M322 ${catY - 48} l12 -6 v22 l-12 6 Z`} fill="#4a5368" />
      </g>

      {/* Ağaçlar */}
      {[
        [520, 470],
        [560, 440],
        [160, 470],
      ].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y} L${x} ${y - 14}`} stroke="#8a5a3c" strokeWidth="3" />
          <circle cx={x} cy={y - 22} r="12" fill="#2fa36b" />
          <circle cx={x - 7} cy={y - 16} r="8" fill="#3fbf7f" />
        </g>
      ))}
    </svg>
  );
}
