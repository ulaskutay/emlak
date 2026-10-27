"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { templateList } from "@arsa/shared";
import { createHref } from "@/lib/tutorials";

/** Şablonların gerçek çıktıları: yatay kaydırılan, tam boy dikey videolar. Görünen video sessiz oynar. */
export function FilmSeridi() {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }),
      { threshold: 0.6 },
    );
    el.querySelectorAll("video").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  return (
    <ul
      ref={root}
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] sm:px-10 lg:gap-6 [&::-webkit-scrollbar]:hidden"
    >
      {templateList.map((t, i) => (
        <li key={t.id} className="w-[min(76vw,330px)] shrink-0 snap-start">
          <Link href={`/sablonlar/${t.id}`} className="group block overflow-hidden rounded-2xl bg-black">
            {t.preview.video ? (
              <video
                src={t.preview.video}
                poster={t.preview.poster}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={`${t.name} örnek videosu`}
                className="block aspect-[9/16] w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.preview.poster} alt={`${t.name} örneği`} loading="lazy" className="block aspect-[9/16] w-full object-cover" />
            )}
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4 border-t border-white/15 pt-3">
            <div>
              <span className="block text-xs text-white/55 tabular-nums">
                {String(i + 1).padStart(2, "0")} / {String(templateList.length).padStart(2, "0")}
              </span>
              <span className="mt-0.5 block leading-snug font-bold">{t.name}</span>
              <span className="mt-0.5 block text-sm text-white/60">
                {t.category}, {t.duration}
              </span>
            </div>
            <Link href={createHref(t.id)} className="shrink-0 text-sm font-bold text-gunes underline-offset-4 hover:underline">
              Oluşturun
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
