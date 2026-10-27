/** Elle çizilmiş drone: dört pervanesi döner, gövdesi havada süzülür. Zemin yok. */
export function DroneCizim({ className = "" }: { className?: string }) {
  const motorlar: [number, number][] = [
    [110, 118],
    [290, 118],
    [110, 262],
    [290, 262],
  ];
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden>
      <defs>
        <linearGradient id="dr-govde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3a6b" />
          <stop offset="1" stopColor="#0d1b3e" />
        </linearGradient>
        <linearGradient id="dr-ust" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a7dff" />
          <stop offset="1" stopColor="#2b6cff" />
        </linearGradient>
        <radialGradient id="dr-cam" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#9fc0ff" />
          <stop offset="0.5" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#0d1b3e" />
        </radialGradient>
        <radialGradient id="dr-golge" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0d1b3e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0d1b3e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Yerdeki yumuşak gölge: drone yükselip alçaldıkça büyüyüp küçülür */}
      <ellipse className="drone-golge" cx="200" cy="356" rx="118" ry="16" fill="url(#dr-golge)" />

      <g className="drone-suzul">
        {/* Kollar */}
        <g stroke="#1b2a52" strokeWidth="14" strokeLinecap="round">
          <line x1="150" y1="162" x2="118" y2="126" />
          <line x1="250" y1="162" x2="282" y2="126" />
          <line x1="150" y1="218" x2="118" y2="254" />
          <line x1="250" y1="218" x2="282" y2="254" />
        </g>
        <g stroke="#2b6cff" strokeWidth="4" strokeLinecap="round" opacity="0.9">
          <line x1="150" y1="158" x2="122" y2="128" />
          <line x1="250" y1="158" x2="278" y2="128" />
        </g>

        {/* İniş ayakları */}
        <g stroke="#1b2a52" strokeWidth="7" strokeLinecap="round" fill="none">
          <path d="M165 228 L158 262 L138 262" />
          <path d="M235 228 L242 262 L262 262" />
        </g>

        {/* Gövde */}
        <rect x="140" y="150" width="120" height="80" rx="30" fill="url(#dr-govde)" />
        <rect x="150" y="156" width="100" height="36" rx="18" fill="url(#dr-ust)" />
        <rect x="160" y="160" width="60" height="10" rx="5" fill="#ffffff" opacity="0.35" />
        {/* Durum ışığı */}
        <circle className="drone-isik" cx="200" cy="209" r="5" fill="#ff6b4a" />

        {/* Kamera gimbal'ı */}
        <rect x="186" y="226" width="28" height="12" rx="5" fill="#1b2a52" />
        <circle cx="200" cy="252" r="18" fill="#0d1b3e" />
        <circle cx="200" cy="252" r="12" fill="url(#dr-cam)" />
        <circle cx="195" cy="247" r="3" fill="#ffffff" opacity="0.8" />

        {/* Motorlar ve pervaneler */}
        {motorlar.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="13" fill="#1b2a52" />
            <circle cx={x} cy={y} r="7" fill="#2b6cff" />
            {/* Dönüş bulanıklığı */}
            <circle cx={x} cy={y} r="48" fill="#2b6cff" opacity="0.06" />
            <circle cx={x} cy={y} r="48" fill="none" stroke="#1b2a52" strokeWidth="1.5" opacity="0.18" />
            <g className="drone-pervane" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * -0.07}s` }}>
              <path
                d={`M${x} ${y} C${x + 10} ${y - 10} ${x + 42} ${y - 12} ${x + 46} ${y} C${x + 42} ${y + 5} ${x + 10} ${y + 6} ${x} ${y} Z`}
                fill="#1b2a52"
                opacity="0.85"
              />
              <path
                d={`M${x} ${y} C${x - 10} ${y + 10} ${x - 42} ${y + 12} ${x - 46} ${y} C${x - 42} ${y - 5} ${x - 10} ${y - 6} ${x} ${y} Z`}
                fill="#1b2a52"
                opacity="0.85"
              />
            </g>
            <circle cx={x} cy={y} r="3.5" fill="#ffd166" />
          </g>
        ))}
      </g>
    </svg>
  );
}
