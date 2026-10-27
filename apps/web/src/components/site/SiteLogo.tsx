/** Sitenin logosu: gök mavisi kare içinde beyaz parsel sınırı ve güneş sarısı köşe kazığı. */
export function SiteLogo({ className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="10" fill="#2b6cff" />
        <polygon
          points="25,11 9,6.5 7.5,15 6,24 13,19.5 21,15.5"
          fill="rgba(255,255,255,.18)"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="6.5" r="2.8" fill="#ffc93c" />
      </svg>
      <span className="text-[1.25rem] font-extrabold tracking-[-0.03em]">Arsa Video</span>
    </span>
  );
}
