"use client";
import { useEffect, useRef, useState } from "react";

/** Telefon çerçevesinde örnek video: sessiz döngüde başlar, sesi kullanıcı açar. */
export function ReelPlayer({
  src,
  poster,
  label = "Örnek video",
  tone = "light",
  className = "",
}: {
  src: string;
  poster: string;
  label?: string;
  tone?: "light" | "dark";
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
      <div className="overflow-hidden rounded-[2rem] border-[7px] border-gece bg-gece shadow-[0_30px_60px_-20px_rgba(18,26,22,.45)]">
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
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${tone === "dark" ? "border-white/30 text-kagit hover:bg-white/10" : "border-murekkep/70 bg-kagit text-murekkep hover:bg-white"}`}
        >
          {paused ? "Oynat" : "Durdur"}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-full bg-sari px-4 py-2 text-sm font-semibold text-murekkep hover:bg-[#ffb21a]"
        >
          {muted ? "Sesli izleyin" : "Sesi kapat"}
        </button>
      </div>
    </div>
  );
}
