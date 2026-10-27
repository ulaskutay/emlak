"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createHref, type Tutorial } from "@/lib/tutorials";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * "Nasıl yapılır": şablon sekmeleri, tarayıcı çerçevesinde panelin ekran kaydı,
 * bölümlere ayrılmış ilerleme çubuğu ve tıklanınca o adıma giden bölüm listesi.
 * Görünürken sessiz oynar; hareket azaltma tercihinde kullanıcı başlatır.
 */
export function HowTo({ tutorials }: { tutorials: Tutorial[] }) {
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tut = tutorials[index]!;
  const t = tut.template;

  const autoplay = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = !!e?.isIntersecting;
        const v = video.current;
        if (!v) return;
        if (visible.current && autoplay()) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Şablon kartlarındaki "Nasıl yapılır" bağlantısı (#nasil-tab-<id>) o sekmeyi açar.
  useEffect(() => {
    const pick = () => {
      const i = tutorials.findIndex((x) => location.hash === `#nasil-tab-${x.template.id}`);
      if (i >= 0) setIndex(i);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [tutorials]);

  // Sekme değişince yeni kayıt baştan ve (görünürse) oynar.
  useEffect(() => {
    setTime(0);
    setDuration(0);
    const v = video.current;
    if (v && visible.current && autoplay()) v.play().catch(() => {});
    // Mobilde sekme şeridi seçili sekmeye kayar (yalnız yatay; sayfa zıplamasın).
    const tab = tabs.current[index];
    const list = tab?.parentElement;
    if (tab && list) list.scrollTo({ left: tab.offsetLeft - list.offsetLeft - 16, behavior: "smooth" });
  }, [index]);

  const ends = tut.chapters.map((c, i) => tut.chapters[i + 1]?.t ?? (duration || c.t + 6));
  const active = Math.max(0, tut.chapters.findLastIndex((c) => time >= c.t));

  function seek(s: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = s;
    v.play().catch(() => {});
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tutorials.length) % tutorials.length;
    setIndex(n);
    tabs.current[n]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Şablon"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {tutorials.map((x, i) => (
          <button
            key={x.template.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`nasil-tab-${x.template.id}`}
            aria-selected={i === index}
            aria-controls="nasil-panel"
            tabIndex={i === index ? 0 : -1}
            onClick={() => setIndex(i)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={`shrink-0 scroll-mt-28 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              i === index ? "bg-gok text-white shadow-[0_8px_20px_-10px_rgba(43,108,255,.8)]" : "border border-ayrac bg-white text-gri hover:border-gok hover:text-gok"
            }`}
          >
            {x.template.name}
          </button>
        ))}
      </div>

      <div
        id="nasil-panel"
        role="tabpanel"
        aria-labelledby={`nasil-tab-${t.id}`}
        className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10"
      >
        <div ref={frame}>
          {/* Tarayıcı çerçevesi: kaydın panelde geçtiği belli olsun */}
          <div className="overflow-hidden rounded-2xl border border-ayrac bg-white shadow-[0_40px_80px_-40px_rgba(13,27,62,.45)]">
            <div className="flex items-center gap-3 border-b border-ayrac px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-mercan" />
                <span className="h-2.5 w-2.5 rounded-full bg-gunes" />
                <span className="h-2.5 w-2.5 rounded-full bg-cimen" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-full bg-zemin px-3 py-1 text-center text-xs font-semibold text-gri">
                Panel · {t.name}
              </span>
            </div>
            <div className="relative">
              <video
                key={tut.video}
                ref={video}
                src={tut.video}
                poster={tut.poster}
                muted
                loop
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
                onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play().catch(() => {}) : e.currentTarget.pause())}
                className="block aspect-video w-full cursor-pointer bg-lacivert object-cover"
                aria-label={`${t.name}: panelde video hazırlama kaydı`}
              />
              {paused && (
                <button
                  type="button"
                  onClick={() => video.current?.play().catch(() => {})}
                  className="absolute inset-0 grid place-items-center bg-lacivert/25"
                  aria-label="Kaydı oynat"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-gok text-white shadow-[0_12px_30px_-8px_rgba(43,108,255,.9)]">
                    <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" aria-hidden>
                      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Bölümlü ilerleme: her parça bir adım, tıklanınca o adıma gider */}
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {tut.chapters.map((c, i) => {
              const len = Math.max(0.001, ends[i]! - c.t);
              const fill = Math.min(1, Math.max(0, (time - c.t) / len));
              return (
                <button
                  key={c.t}
                  type="button"
                  tabIndex={-1}
                  onClick={() => seek(c.t)}
                  style={{ flexGrow: len }}
                  className="group h-5 basis-0 py-2"
                >
                  <span className="block h-1.5 overflow-hidden rounded-full bg-ayrac group-hover:bg-[#cdd7ea]">
                    <span className="block h-full rounded-full bg-gok" style={{ width: `${fill * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="text-sm font-semibold text-gri">
            {t.category} · video <span className="tabular-nums">{t.duration}</span>
          </p>
          <h3 className="mt-1 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">{t.name}</h3>
          <p className="mt-2 text-[1rem] leading-relaxed text-gri">{t.tagline}</p>

          <ol className="mt-6 space-y-1.5">
            {tut.chapters.map((c, i) => (
              <li key={c.t}>
                <button
                  type="button"
                  onClick={() => seek(c.t)}
                  aria-current={i === active ? "step" : undefined}
                  className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors ${
                    i === active ? "bg-gok-acik text-lacivert" : "text-gri hover:bg-white hover:text-lacivert"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums transition-colors ${
                      i === active ? "bg-gok text-white" : "border border-ayrac bg-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[1rem] font-bold">{c.label}</span>
                  <span className="text-xs tabular-nums opacity-70">{clock(c.t)}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 lg:mt-auto lg:pt-8">
            <Link href={createHref(t.id)} className="site-btn-primary">
              Hemen oluşturun
            </Link>
            <Link href={`/sablonlar/${t.id}`} className="font-bold text-gok underline-offset-4 hover:underline">
              Şablonu inceleyin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
