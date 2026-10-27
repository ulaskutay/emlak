"use client";
import { useEffect, useRef } from "react";

const PHONES = [
  {
    src: "/media/ornek-reel.mp4",
    poster: "/media/ornek-reel-poster.jpg",
    cls: "-rotate-[8deg] translate-y-8",
    icon: "📍",
    title: "Drone ile arsa",
    from: "Ada ve parsel no ile",
  },
  {
    src: "/media/sablon-sunucu.mp4",
    poster: "/media/sablon-sunucu-poster.jpg",
    cls: "z-10 scale-[1.08]",
    icon: "🎙️",
    title: "Sunuculu tur",
    from: "Emlakçı ilanı anlatır",
  },
  {
    src: "/media/sablon-dosenmis.mp4",
    poster: "/media/sablon-dosenmis-poster.jpg",
    cls: "rotate-[8deg] translate-y-8",
    icon: "🛋️",
    title: "Sanal eşya döşeme",
    from: "Boş daire fotoğrafından",
  },
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
    <div ref={root} className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute inset-x-6 top-10 bottom-0 rounded-[3rem] bg-gradient-to-br from-gok/25 via-gunes/30 to-mercan/25 blur-2xl" />
      <div className="relative grid grid-cols-3 items-start gap-3 px-2 sm:gap-4">
        {PHONES.map((p) => (
          <figure key={p.src} className="flex flex-col items-center">
            <div
              className={`w-full overflow-hidden rounded-[1.6rem] border-[5px] border-lacivert bg-lacivert shadow-[0_30px_60px_-25px_rgba(13,27,62,.7)] sm:rounded-[2rem] sm:border-[6px] ${p.cls}`}
            >
              <video aria-hidden src={p.src} poster={p.poster} muted loop playsInline preload="metadata" className="block aspect-[9/16] w-full object-cover" />
            </div>
            <figcaption className={`text-center ${p.cls.includes("translate-y") ? "mt-14" : "mt-6"}`}>
              <span className="block text-xs font-bold text-balance text-lacivert sm:text-sm">
                <span aria-hidden className="mr-1">{p.icon}</span>
                {p.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-balance text-lacivert/60 sm:text-xs">{p.from}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
