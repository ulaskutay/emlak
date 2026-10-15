export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <polygon points="5,24 13,7 27,12 22,26" fill="rgba(0,229,255,.15)" stroke="#00e5ff" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="13" cy="7" r="2.6" fill="#ffc83d" />
      </svg>
      <span>
        Arsa<span className="text-neon">Video</span>
      </span>
    </span>
  );
}
