"use client";
import { useEffect, useRef, useState } from "react";

/** Telefon çerçevesinde örnek video: sessiz döngüde başlar, sesi kullanıcı açar. */
export function ReelPlayer({
  src,
  poster,
  label = "Örnek video",
  className = "",
}: {
  src: string;
  poster: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Hareket azaltma tercihinde otomatik oynatma yok
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.play().catch(() => {});
  }, []);

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    if (muted) {
      v.currentTime = 0;
      v.muted = false;
      v.play().catch(() => {});
    } else {
      v.muted = true;
    }
    setMuted(!muted);
  }

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[2.25rem] border-[8px] border-lacivert bg-lacivert shadow-[0_40px_80px_-30px_rgba(13,27,62,.55)]">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        className="block aspect-[9/16] w-full object-cover"
        aria-label={label}
      />
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-full border border-ayrac bg-white px-4 py-2 text-sm font-bold text-lacivert hover:border-gok hover:text-gok"
        >
          {paused ? "Oynat" : "Durdur"}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-full bg-gok px-4 py-2 text-sm font-bold text-white hover:bg-gok-koyu"
        >
          {muted ? "Sesli izleyin" : "Sesi kapat"}
        </button>
      </div>
    </div>
  );
}
