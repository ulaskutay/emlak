"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const sure = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Ana sayfa hero'su: tam ekran vizör. Zeminde gerçek drone çıktısı (Dalyan Köyü, Ezine) sessiz döngüde oynar;
 * geniş ekranda videonun yalnız orta şeridi görünür, gömülü başlık ve altyazı dışarıda kalır;
 * telefonda video üstte kalır, yazı alanı koyu geçişle örtülür. Köşe işaretleri
 * ekranın kendisini çerçeveler; sağ üstte videodan okunan künye, sol altta başlık ve çağrı.
 */
export function HeroUcus() {
  const video = useRef<HTMLVideoElement>(null);
  const [an, setAn] = useState(0);

  useEffect(() => {
    const v = video.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.play().catch(() => {});
  }, []);

  return (
    <section className="relative isolate -mt-[76px] flex min-h-[100svh] flex-col justify-end overflow-hidden bg-lacivert text-white">
      <video
        ref={video}
        src="/media/ornek-reel.mp4"
        poster="/media/ornek-reel-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => setAn(e.currentTarget.currentTime)}
        aria-label="Arsa drone turu örnek videosu"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%] max-lg:object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,#0d1b3e_0%,rgba(13,27,62,.94)_42%,rgba(13,27,62,.55)_68%,rgba(13,27,62,.15)_100%)] lg:bg-[linear-gradient(to_top,#0d1b3e_0%,rgba(13,27,62,.78)_30%,rgba(13,27,62,.2)_62%,rgba(13,27,62,.45)_100%)]"
      />

      {/* Vizör köşeleri: ekranın kendisi vizördür */}
      <div aria-hidden className="pointer-events-none absolute inset-3 sm:inset-5">
        <span className="absolute top-0 left-0 h-9 w-9 rounded-tl-2xl border-t-[3px] border-l-[3px] border-gunes" />
        <span className="absolute top-0 right-0 h-9 w-9 rounded-tr-2xl border-t-[3px] border-r-[3px] border-gunes" />
        <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-2xl border-b-[3px] border-l-[3px] border-gunes" />
        <span className="absolute right-0 bottom-0 h-9 w-9 rounded-br-2xl border-r-[3px] border-b-[3px] border-gunes" />
      </div>

      {/* Künye: videodaki gerçek parsel */}
      <dl className="absolute top-24 right-9 hidden text-right lg:block xl:right-12">
        {[
          ["Konum", "Dalyan Köyü, Ezine"],
          ["Ada / parsel", "230 / 3"],
          ["Alan", "11.091 m²"],
          ["Nitelik", "Zeytinlik"],
        ].map(([k, v]) => (
          <div key={k} className="mt-3 first:mt-0">
            <dt className="text-xs text-white/60">{k}</dt>
            <dd className="font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="relative mx-auto w-full max-w-[1400px] px-6 pt-40 pb-12 sm:px-10 lg:pb-16">
        <p className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
          <span aria-hidden className="h-2 w-2 rounded-full bg-mercan" />
          <span className="tabular-nums">{sure(an)}</span>
          <span className="hidden text-white/50 sm:inline">Gerçek çıktı, ada ve parsel numarasından</span>
        </p>
        <h1 className="mt-5 max-w-[11ch] text-[clamp(3rem,9vw,8.5rem)] leading-[0.9] font-extrabold tracking-[-0.03em] text-balance">
          Drone uçurmadan, arsanızın drone videosu.
        </h1>
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[36rem] text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-relaxed text-[#c3cce0]">
            Ada ve parsel numarasını yazın ya da ilan fotoğraflarını yükleyin. Seslendirmeli, müzikli dikey video dakikalar
            içinde panelinizde.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sablonlar" className="site-btn h-14 bg-gunes px-8 text-base text-lacivert hover:bg-[#ffbf1a]">
              Hemen oluşturun
            </Link>
            <Link href="/ornekler" className="site-btn h-14 border border-white/30 px-6 text-base text-white hover:bg-white/10">
              Örnekleri izleyin
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
