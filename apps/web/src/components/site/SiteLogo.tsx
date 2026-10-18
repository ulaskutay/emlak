/** Sitenin logosu: mürekkep kare içinde sarı parsel sınırı ve köşe kazığı. */
export function SiteLogo({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={tone === "light" ? "#1e2a23" : "#ffc24d"} />
        <polygon
          points="25,11 9,6.5 7.5,15 6,24 13,19.5 21,15.5"
          fill="none"
          stroke={tone === "light" ? "#ffc24d" : "#1e2a23"}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="6.5" r="2.4" fill={tone === "light" ? "#ffc24d" : "#1e2a23"} />
      </svg>
      <span className="font-display text-[1.25rem] font-bold tracking-[-0.02em]">Arsa Video</span>
    </span>
  );
}
