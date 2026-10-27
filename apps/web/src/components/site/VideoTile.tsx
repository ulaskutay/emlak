"use client";
import { useRef, useState } from "react";

/** Dikey örnek video kutucuğu: kapak görünür; üzerine gelince ya da dokununca sessiz oynar. */
export function VideoTile({
  src,
  poster,
  label,
  sub,
  className = "",
}: {
  src?: string;
  poster: string;
  label: string;
  sub?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (!src || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.play().catch(() => {});
  };
  const stop = () => ref.current?.pause();

  return (
    <figure className={`group ${className}`} onMouseEnter={play} onMouseLeave={stop}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.5rem] bg-gok-acik shadow-[0_20px_40px_-24px_rgba(13,27,62,.5)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {src && (
          <video
            ref={ref}
            src={src}
            muted
            loop
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {src && (
          <button
            type="button"
            onClick={() => (playing ? stop() : ref.current?.play().catch(() => {}))}
            onFocus={play}
            onBlur={stop}
            aria-label={`${label}: ${playing ? "durdur" : "oynat"}`}
            className="absolute inset-0 grid place-items-center"
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-full bg-white/90 text-gok shadow-lg transition-opacity ${playing ? "opacity-0" : "opacity-100 group-hover:opacity-0"}`}
            >
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" aria-hidden>
                <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 px-1">
        <span className="block text-[0.9375rem] font-bold">{label}</span>
        {sub && <span className="mt-0.5 block text-sm text-gri">{sub}</span>}
      </figcaption>
    </figure>
  );
}
