"use client";
import { presenterList, templateList, type TemplateInfo } from "@arsa/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sablonCiktilari, type Ornek } from "@/lib/ornekler";
import { createHref } from "@/lib/tutorials";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Tik = () => (
  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-cimen" aria-hidden>
    <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Şablonlar sayfası: üstte şablon seçici, altında her şablon için son çıktılarla büyük bir vitrin. */
export function SablonVitrini({ credits, howTo = [] }: { credits: Record<string, string>; howTo?: string[] }) {
  return (
    <>
      <nav aria-label="Şablon seçin" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {templateList.map((t, i) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className="group site-kart flex items-center gap-3 p-2.5 pr-3 transition hover:-translate-y-0.5 hover:border-gok"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.preview.poster} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0">
              <span className="block text-xs font-bold text-gri tabular-nums">0{i + 1}</span>
              <span className="block text-[0.9375rem] leading-tight font-bold text-lacivert group-hover:text-gok">{t.name}</span>
              <span className="mt-0.5 block text-xs font-semibold text-gok">{credits[t.id]}</span>
            </span>
          </a>
        ))}
      </nav>

      <div className="mt-16 flex flex-col gap-10 md:mt-20 md:gap-14">
        {templateList.map((t, i) => (
          <SablonBolumu key={t.id} t={t} index={i} credit={credits[t.id]} howTo={howTo.includes(t.id)} />
        ))}
      </div>
    </>
  );
}

function SablonBolumu({ t, index, credit, howTo }: { t: TemplateInfo; index: number; credit?: string; howTo: boolean }) {
  const ciktilar = sablonCiktilari(t.id);
  const [sec, setSec] = useState(0);
  const o = ciktilar[sec] ?? ciktilar[0];
  const ters = index % 2 === 1;

  return (
    <section id={t.id} aria-labelledby={`${t.id}-baslik`} className="site-kart scroll-mt-28 overflow-hidden">
      <div className={`grid items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] ${ters ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="flex flex-col items-center gap-5 bg-[radial-gradient(120%_90%_at_50%_0%,#1b2f63_0%,#0d1b3e_70%)] px-5 py-8 sm:px-8 sm:py-10">
          {o && <Sahne key={o.poster} o={o} />}
          {ciktilar.length > 1 && (
            <div className="w-full max-w-[22rem]">
              <p className="mb-2 text-center text-xs font-semibold tracking-wide text-white/60 uppercase">Son çıktılardan</p>
              <div role="group" aria-label={`${t.name} örnekleri`} className="flex justify-center gap-2">
                {ciktilar.slice(0, 5).map((x, k) => (
                  <button
                    key={x.poster}
                    type="button"
                    aria-pressed={k === sec}
                    aria-label={`${k + 1}. örnek`}
                    onClick={() => setSec(k)}
                    className={`relative aspect-[9/16] w-14 overflow-hidden rounded-lg transition ${
                      k === sec ? "ring-2 ring-gunes ring-offset-2 ring-offset-lacivert" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-gok tabular-nums">0{index + 1}</span>
            <span className="site-etiket">{t.category}</span>
            {t.badge && <span className="rounded-full bg-gunes px-3 py-1 text-sm font-bold text-lacivert">{t.badge}</span>}
          </div>
          <h2 id={`${t.id}-baslik`} className="mt-4 text-[clamp(1.75rem,3vw,2.375rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
            {t.name}
          </h2>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-gri">{t.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gok-acik px-4 py-3">
              <dt className="text-xs font-semibold text-gri">Video süresi</dt>
              <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{t.duration}</dd>
            </div>
            <div className="rounded-2xl bg-gunes-acik px-4 py-3">
              <dt className="text-xs font-semibold text-gri">Kredi</dt>
              <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{credit ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">Videoda neler var</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-gri">
                {t.includes.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Tik />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold">Sizden istenen</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-gri">
                {t.needs.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gok" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {t.id === "sunucu-ev" && (
            <div className="mt-6">
              <h3 className="text-sm font-bold">Sunucunuzu seçin</h3>
              <ul className="mt-2 flex flex-wrap gap-3">
                {presenterList.map((p) => (
                  <li key={p.id} className="flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/sunucular/${p.id}.jpg`} alt="" loading="lazy" className="h-14 w-14 rounded-full object-cover object-top ring-2 ring-ayrac" />
                    <span className="text-xs font-semibold text-gri">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
            <Link href={createHref(t.id)} className="site-btn-primary">
              Hemen oluşturun
            </Link>
            {howTo && (
              <a href={`/nasil-yapilir#nasil-tab-${t.id}`} className="site-btn-secondary">
                Nasıl yapılır?
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Telefon çerçevesinde örnek: görünür olunca sessiz oynar, ekrandan çıkınca durur. */
function Sahne({ o }: { o: Ornek }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduced()) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative aspect-[9/16] w-full max-w-[13.5rem] sm:max-w-[17rem] overflow-hidden rounded-[1.75rem] border-[6px] border-white/10 bg-black shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={o.poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      {o.src && (
        <video ref={ref} src={o.src} poster={o.poster} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />
      )}
    </div>
  );
}
