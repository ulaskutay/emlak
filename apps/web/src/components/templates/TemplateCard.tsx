"use client";
import type { TemplateInfo } from "@arsa/shared";
import Link from "next/link";
import { useRef } from "react";

/** Galeri kartı: kapak görünür, üzerine gelince (ya da odakta) örnek video sessiz oynar. */
export function TemplateCard({ t, href, priority = false }: { t: TemplateInfo; href: string; priority?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const play = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.current?.play().catch(() => {});
  };
  const stop = () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <Link
      href={href}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sari"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#1d2a23]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={t.preview.poster}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {t.preview.video && (
          <video
            ref={video}
            src={t.preview.video}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        )}
        {t.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-sari px-2.5 py-1 text-xs font-semibold text-murekkep">{t.badge}</span>
        )}
      </div>
      <div className="mt-3.5 px-1">
        <h3 className="font-display text-[1.25rem] leading-tight font-semibold tracking-[-0.015em] text-kagit group-hover:text-sari">{t.name}</h3>
        <p className="mt-1 text-[0.9375rem] leading-snug text-[#c9d0c6]">{t.tagline}</p>
      </div>
      <div className="mt-2 flex justify-between px-1 text-sm text-[#8f988c]">
        <span>{t.category}</span>
        <span className="tabular-nums">{t.duration}</span>
      </div>
    </Link>
  );
}
