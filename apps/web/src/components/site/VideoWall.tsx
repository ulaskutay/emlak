"use client";
import { useEffect, useRef, useState } from "react";

/** Gerçek şablon çıktılarından kısa döngüler (public/media/duvar). Video yoksa yalnız kapak. */
const TILES: { name: string; video?: boolean }[] = [
  { name: "arsa-1", video: true },
  { name: "ilan-1", video: true },
  { name: "ilan-3", video: true },
  { name: "arsa-3", video: true },
  { name: "ilan-2", video: true },
  { name: "bitmis-1" },
  { name: "ilan-5", video: true },
  { name: "arsa-2", video: true },
  { name: "ilan-4", video: true },
  { name: "arsa-4", video: true },
  { name: "ilan-6", video: true },
];

const COLUMNS = 5;
const PER_COLUMN = 3;
// Sütun hızları farklı: duvar tek blok gibi kaymasın.
const DURATIONS = [58, 46, 64, 50, 60];

/**
 * Hero arkasındaki video duvarı: sütunlar yavaşça yukarı/aşağı kayar.
 * Hareket azaltma tercihinde ve küçük ekranda video yerine kapak; görünmüyorken videolar durur.
 */
export function VideoWall() {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"poster" | "video">("poster");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 639px)").matches;
    if (!reduce && !small) setMode("video");
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || mode !== "video") return;
    const io = new IntersectionObserver(([e]) => {
      el.querySelectorAll("video").forEach((v) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    Array.from({ length: PER_COLUMN }, (_, i) => TILES[(c * PER_COLUMN + i * 2 + c) % TILES.length]!),
  );

  return (
    <div ref={root} aria-hidden className="absolute inset-0 grid grid-cols-3 gap-3 px-3 sm:grid-cols-4 lg:grid-cols-5">
      {columns.map((tiles, c) => (
        <div key={c} className={`overflow-hidden ${c === 3 ? "hidden sm:block" : ""} ${c === 4 ? "hidden lg:block" : ""}`}>
          <div
            className="video-duvar-sutun flex flex-col gap-3"
            style={{ animationDuration: `${DURATIONS[c]}s`, animationDirection: c % 2 ? "reverse" : "normal" }}
          >
            {[...tiles, ...tiles].map((t, i) => (
              <div key={i} className="aspect-[9/16] overflow-hidden rounded-xl bg-[#1d2a23]">
                {mode === "video" && t.video ? (
                  <video
                    src={`/media/duvar/${t.name}.mp4`}
                    poster={`/media/duvar/${t.name}.jpg`}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="auto"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/duvar/${t.name}.jpg`} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
