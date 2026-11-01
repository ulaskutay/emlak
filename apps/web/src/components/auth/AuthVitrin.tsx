"use client";
import type { TemplateInfo } from "@arsa/shared";
import { useEffect, useState } from "react";

const SURE = 7000;

/**
 * Giriş/kayıt sağ paneli: şablonların örnek videoları sırayla oynar, alttaki sekmelerle seçilir.
 * Sabit şablon verildiyse (kullanıcı bir şablondan geldiyse) yalnız o gösterilir; azaltılmış harekette dönmez, kapak durur.
 */
export function AuthVitrin({ templates, fixed }: { templates: TemplateInfo[]; fixed?: string }) {
  const start = Math.max(0, templates.findIndex((t) => t.id === fixed));
  const [i, setI] = useState(start);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(m.matches);
    const on = () => setStill(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (fixed || still) return;
    const id = setTimeout(() => setI((n) => (n + 1) % templates.length), SURE);
    return () => clearTimeout(id);
  }, [i, fixed, still, templates.length]);

  const t = templates[i];

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-lacivert text-white">
      <style>{"@keyframes vitrin-dolum{from{width:0}to{width:100%}}"}</style>
      <div className="absolute inset-0">
        {templates.map((x, n) => (
          <div key={x.id} className={`absolute inset-0 transition-opacity duration-1000 ${n === i ? "opacity-100" : "opacity-0"}`} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.preview.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {n === i && x.preview.video && !still && (
              <video key={x.id} src={x.preview.video} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,27,62,.55)_0%,rgba(13,27,62,0)_28%,rgba(13,27,62,.2)_55%,rgba(13,27,62,.92)_100%)]" />
      </div>

      <p className="relative m-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-bold backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-gunes" aria-hidden />
        {fixed ? "Seçtiğiniz şablon" : "Örnek videolar"}
      </p>

      <div className="relative mt-auto p-8 xl:p-10" aria-live="polite">
        <p className="text-sm font-bold text-gunes">
          {t.category} · <span className="tabular-nums">{t.duration}</span>
        </p>
        <h2 className="mt-2 text-[2rem] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance xl:text-[2.4rem]">{t.name}</h2>
        <p className="mt-3 max-w-md text-[1.0625rem] leading-snug text-white/80">{t.tagline}</p>

        {!fixed && (
          <div className="mt-7 flex gap-1.5" role="tablist" aria-label="Şablonlar">
            {templates.map((x, n) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={x.name}
                onClick={() => setI(n)}
                className="group relative h-8 flex-1"
              >
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                  <span
                    key={n === i ? `${i}-on` : n}
                    className={`block h-full rounded-full bg-white ${n === i ? (still ? "w-full" : "animate-[vitrin-dolum_7s_linear_forwards]") : n < i ? "w-full" : "w-0"}`}
                  />
                </span>
              </button>
            ))}
          </div>
        )}

        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-semibold text-white/75">
          <li>Çekim ekibi yok</li>
          <li>Birkaç dakikada hazır</li>
          <li>1080p 60 FPS</li>
        </ul>
      </div>
    </div>
  );
}
