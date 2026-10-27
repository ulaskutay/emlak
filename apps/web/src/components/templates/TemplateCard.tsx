"use client";
import type { SoonTemplate, TemplateInfo } from "@arsa/shared";
import Link from "next/link";
import { useRef } from "react";

type Tone = "light" | "dark";

const text = (tone: Tone) =>
  tone === "dark"
    ? { title: "text-kagit group-hover:text-sari", body: "text-[#c9d0c6]", meta: "text-[#8f988c]", box: "bg-[#1d2a23]" }
    : { title: "text-lacivert group-hover:text-gok", body: "text-gri", meta: "text-gri/80", box: "bg-gok-acik" };

/** Galeri kartı: kapak görünür, üzerine gelince (ya da odakta) örnek video sessiz oynar. */
export function TemplateCard({ t, href, tone = "dark", priority = false }: { t: TemplateInfo; href: string; tone?: Tone; priority?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const c = text(tone);
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
      className={`group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 ${tone === "dark" ? "focus-visible:outline-sari" : "focus-visible:outline-gok"}`}
    >
      <div className={`relative aspect-[4/5] overflow-hidden ${tone === "dark" ? "rounded-xl" : "rounded-2xl"} ${c.box}`}>
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
          <span
            className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${tone === "dark" ? "bg-sari text-murekkep" : "bg-gunes text-lacivert"}`}
          >
            {t.badge}
          </span>
        )}
      </div>
      <h3 className={`mt-3 text-[1.0625rem] leading-tight font-bold tracking-[-0.01em] ${tone === "dark" ? "font-display" : ""} ${c.title}`}>{t.name}</h3>
      <p className={`mt-1 text-sm leading-snug ${c.body}`}>{t.tagline}</p>
      <p className={`mt-1.5 text-[0.8125rem] ${c.meta}`}>
        {t.category} <span className="tabular-nums">{t.duration}</span>
      </p>
    </Link>
  );
}

/** Henüz sipariş alınmayan şablon: görselsiz, tıklanmaz, küçük satır. */
export function SoonCard({ t, tone = "dark" }: { t: SoonTemplate; tone?: Tone }) {
  const c = text(tone);
  return (
    <li className={`border border-dashed p-4 ${tone === "dark" ? "rounded-xl border-white/15" : "rounded-2xl border-[#c9d3e6] bg-white/60"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[1.0625rem] font-bold ${tone === "dark" ? "font-display text-kagit" : "text-lacivert"}`}>{t.name}</span>
        <span className={`shrink-0 text-[0.8125rem] ${c.meta}`}>{t.category}</span>
      </div>
      <p className={`mt-1 text-sm leading-snug ${c.body}`}>{t.tagline}</p>
    </li>
  );
}
