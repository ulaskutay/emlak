"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TEMPLATES, type TemplateId } from "@arsa/shared";
import { createHref } from "@/lib/tutorials";

type Kunye = { etiket: string; deger: string };

/** Vizörde oynayan gerçek çıktılar; künyedeki bilgiler o videodan okunur. */
const CEKIMLER: { id: TemplateId; sekme: string; kunye: Kunye[] }[] = [
  {
    id: "arsa-drone",
    sekme: "Arsa",
    kunye: [
      { etiket: "Konum", deger: "Dalyan Köyü, Ezine" },
      { etiket: "Ada / parsel", deger: "230 / 3" },
      { etiket: "Alan", deger: "11.091 m²" },
    ],
  },
  {
    id: "sunucu-ev",
    sekme: "Sunuculu ev",
    kunye: [
      { etiket: "Girdi", deger: "İlan fotoğrafları" },
      { etiket: "Anlatım", deger: "Türkçe sunucu" },
      { etiket: "Süre", deger: "36 sn" },
    ],
  },
  {
    id: "dosenmis-ev",
    sekme: "Eşya döşeme",
    kunye: [
      { etiket: "Girdi", deger: "Boş oda fotoğrafı" },
      { etiket: "Çıktı", deger: "Döşenmiş oda turu" },
      { etiket: "Süre", deger: "21 sn" },
    ],
  },
  {
    id: "insaat-videosu",
    sekme: "İnşaat",
    kunye: [
      { etiket: "Girdi", deger: "Parsel ve proje görseli" },
      { etiket: "Çıktı", deger: "Temelden bitmiş binaya" },
      { etiket: "Süre", deger: "24 sn" },
    ],
  },
];

const sure = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Ana sayfa hero'su: koyu bantta drone vizörü. Vizörde seçilen şablonun gerçek çıktısı oynar,
 * zemin aynı videonun bulanık kapağıdır; yanında videodan okunan künye durur.
 */
export function HeroVizor() {
  const [secili, setSecili] = useState(0);
  const [an, setAn] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const cekim = CEKIMLER[secili]!;
  const t = TEMPLATES[cekim.id];

  // Görünürken sessiz döngü; hareket azaltılmışsa kapak kalır.
  useEffect(() => {
    const v = video.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, [secili]);

  return (
    <section className="relative isolate -mt-[76px] overflow-hidden bg-lacivert pt-[76px] text-white">
      {/* Zemin: aynı çekimin kapağı, bulanık; yazı tarafı koyulaştırılır */}
      {CEKIMLER.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c.id}
          src={TEMPLATES[c.id].preview.poster}
          alt=""
          aria-hidden
          className={`absolute inset-0 -z-20 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-700 ${i === secili ? "opacity-55" : "opacity-0"}`}
        />
      ))}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#0d1b3e_15%,rgba(13,27,62,.82)_55%,rgba(13,27,62,.45))]" />

      <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-10 px-4 pt-8 pb-14 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-20">
        <div>
          <p className="text-[0.9375rem] font-semibold text-gunes">Drone uçurmadan, çekim ekibi olmadan</p>
          <h1 className="mt-4 max-w-[13ch] text-[clamp(2.6rem,6.2vw,5rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance">
            İlanınızın videosu dakikalar içinde hazır.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-relaxed text-[#c3cce0]">
            Ada ve parsel numarasını yazın ya da ilan fotoğraflarınızı yükleyin; seslendirmeli, müzikli, dikey tanıtım videonuz
            panelinize gelsin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 sm:mt-9">
            <Link href="/sablonlar" className="site-btn h-13 bg-gunes px-6 text-base sm:h-14 sm:px-8 text-lacivert hover:bg-[#ffbf1a]">
              Hemen oluşturun
            </Link>
            <Link href="/nasil-yapilir" className="site-btn h-13 border border-white/25 px-5 text-base sm:h-14 sm:px-6 text-white hover:bg-white/10">
              Nasıl yapılır izleyin
            </Link>
          </div>
          <ul className="mt-9 hidden gap-2 text-[0.9375rem] text-[#c3cce0] sm:flex sm:flex-wrap sm:gap-x-6">
            {["Reels, TikTok ve Shorts için 9:16", "Türkçe seslendirme ve altyazı", "Ofis adınız ve telefonunuz videoda"].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-gunes">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {x}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[460px] lg:mr-0">
          {/* Şablon seçici: vizördeki çekimi değiştirir */}
          <div role="tablist" aria-label="Örnek çekim" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {CEKIMLER.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === secili}
                onClick={() => {
                  setSecili(i);
                  setAn(0);
                }}
                className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors ${
                  i === secili ? "bg-white text-lacivert" : "text-white/75 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                }`}
              >
                {c.sekme}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:gap-6">
            {/* Vizör: köşe işaretleri, süre sayacı */}
            <div className="relative p-2.5">
              <span aria-hidden className="absolute top-0 left-0 h-7 w-7 rounded-tl-xl border-t-2 border-l-2 border-gunes" />
              <span aria-hidden className="absolute top-0 right-0 h-7 w-7 rounded-tr-xl border-t-2 border-r-2 border-gunes" />
              <span aria-hidden className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-2 border-l-2 border-gunes" />
              <span aria-hidden className="absolute right-0 bottom-0 h-7 w-7 rounded-br-xl border-r-2 border-b-2 border-gunes" />
              <div className="relative overflow-hidden rounded-xl bg-black shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]">
                <video
                  key={t.id}
                  ref={video}
                  src={t.preview.video}
                  poster={t.preview.poster}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onTimeUpdate={(e) => setAn(e.currentTarget.currentTime)}
                  aria-label={`${t.name} örnek videosu`}
                  className="block aspect-[9/16] w-full object-cover"
                />
                <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold tabular-nums backdrop-blur">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mercan" />
                  {sure(an)}
                </span>
              </div>
            </div>

            {/* Künye: videodaki bilgiler */}
            <dl className="w-[9.5rem] space-y-4 pb-3 sm:w-44">
              <div>
                <dt className="text-xs text-white/55">Şablon</dt>
                <dd className="mt-0.5 leading-snug font-bold">{t.name}</dd>
              </div>
              {cekim.kunye.map((k) => (
                <div key={k.etiket} className="border-t border-white/15 pt-3">
                  <dt className="text-xs text-white/55">{k.etiket}</dt>
                  <dd className="mt-0.5 leading-snug font-bold tabular-nums">{k.deger}</dd>
                </div>
              ))}
              <Link
                href={createHref(t.id)}
                className="inline-flex text-sm font-bold text-gunes underline-offset-4 hover:underline"
              >
                Bu videoyu oluşturun
              </Link>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
