"use client";
import { useEffect, useRef } from "react";

const PHONES = [
  { src: "/media/ornek-reel.mp4", poster: "/media/ornek-reel-poster.jpg", cls: "-rotate-[8deg] translate-y-8" },
  { src: "/media/sablon-sunucu.mp4", poster: "/media/sablon-sunucu-poster.jpg", cls: "z-10 scale-[1.08]" },
  { src: "/media/sablon-dosenmis.mp4", poster: "/media/sablon-dosenmis-poster.jpg", cls: "rotate-[8deg] translate-y-8" },
];

/** Hero görseli: üç telefonda gerçek şablon çıktıları, görünürken sessiz döngüde. */
export function HeroPhones() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      el.querySelectorAll("video").forEach((v) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} aria-hidden className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute inset-x-6 top-10 bottom-0 rounded-[3rem] bg-gradient-to-br from-gok/25 via-gunes/30 to-mercan/25 blur-2xl" />
      <div className="relative grid grid-cols-3 items-center gap-3 px-2 sm:gap-4">
        {PHONES.map((p) => (
          <div
            key={p.src}
            className={`overflow-hidden rounded-[1.6rem] border-[5px] border-lacivert bg-lacivert shadow-[0_30px_60px_-25px_rgba(13,27,62,.7)] sm:rounded-[2rem] sm:border-[6px] ${p.cls}`}
          >
            <video src={p.src} poster={p.poster} muted loop playsInline preload="metadata" className="block aspect-[9/16] w-full object-cover" />
          </div>
        ))}
      </div>

      <span className="suzul absolute top-6 -left-6 hidden items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-bold shadow-[0_16px_30px_-14px_rgba(13,27,62,.45)] sm:flex">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gunes-acik text-base">📍</span>
        230 ada 3 parsel
      </span>
      <span
        className="suzul absolute top-1/2 -right-6 hidden items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-bold shadow-[0_16px_30px_-14px_rgba(13,27,62,.45)] sm:flex"
        style={{ animationDelay: "-2s" }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-mercan-acik text-base">🎙️</span>
        Türkçe seslendirme
      </span>
      <span
        className="suzul absolute -bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-bold whitespace-nowrap shadow-[0_16px_30px_-14px_rgba(13,27,62,.45)]"
        style={{ animationDelay: "-3.5s" }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-cimen-acik text-cimen">✓</span>
        Video hazır, indirin
      </span>
    </div>
  );
}
