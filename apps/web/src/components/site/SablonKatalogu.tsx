"use client";
import Link from "next/link";
import { useState } from "react";
import { SOON_TEMPLATES, TEMPLATE_CATEGORIES, templateList, type TemplateCategory } from "@arsa/shared";
import { createHref } from "@/lib/tutorials";
import { VizorCercevesi } from "./VizorCercevesi";

/** Kategorilerin tek cümlelik açıklamaları. */
const KATEGORI: Record<TemplateCategory, string> = {
  Arsa: "Ada/parsel numarasından havadan tanıtım; arsaya gitmeden.",
  Konut: "İlan fotoğraflarından sinematik tur, sanal eşya döşeme ve sunuculu anlatım.",
  Proje: "Boş arsadan yükselen binayı gösteren inşaat videoları.",
  "Sosyal medya": "Satıldı ve fiyat güncellemesi gibi kısa paylaşımlar.",
};

type Secim = "Tümü" | TemplateCategory;

const KATEGORILER = TEMPLATE_CATEGORIES.filter(
  (k) => templateList.some((t) => t.category === k) || SOON_TEMPLATES.some((t) => t.category === k),
);

/** Ana sayfa: tüm şablonlar tek ızgarada, üstte kategori sekmeleri; her kartta önizleme ve künye (süre, gerekenler). */
export function SablonKatalogu() {
  const [secim, setSecim] = useState<Secim>("Tümü");
  const sablonlar = templateList.filter((t) => secim === "Tümü" || t.category === secim);
  const yakinda = SOON_TEMPLATES.filter((t) => secim === "Tümü" || t.category === secim);
  const sayi = (k: Secim) =>
    k === "Tümü" ? templateList.length : templateList.filter((t) => t.category === k).length;

  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
      <div className="text-center">
        <h2 className="mx-auto max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
          Ne tanıtmak istiyorsunuz?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[1.0625rem] text-gri">
          {templateList.length} hazır şablon; hepsi dikey, seslendirmeli ve ofis bilgilerinizle.
        </p>
      </div>

      {/* Sekmeler: mobilde yatay kaydırılır */}
      <div className="-mx-4 mt-10 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Şablon kategorileri" className="mx-auto flex w-max gap-2 rounded-full border border-ayrac bg-white p-1.5">
          {(["Tümü", ...KATEGORILER] as Secim[]).map((k) => {
            const aktif = secim === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={aktif}
                onClick={() => setSecim(k)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                  aktif ? "bg-lacivert text-white" : "text-gri hover:bg-zemin hover:text-lacivert"
                }`}
              >
                {k}
                <span className={`text-xs ${aktif ? "text-white/70" : "text-gri/70"}`}>{sayi(k) || "yakında"}</span>
              </button>
            );
          })}
        </div>
      </div>
      {secim !== "Tümü" && <p className="mt-4 text-center text-gri">{KATEGORI[secim]}</p>}

      <ul className="mt-8 grid grid-cols-2 gap-x-2 gap-y-8 sm:gap-x-4 md:grid-cols-3">
        {sablonlar.map((t) => (
          <li key={t.id} className="group flex flex-col">
            <Link href={`/sablonlar/${t.id}`} className="relative block">
              <VizorCercevesi className="[&>span]:opacity-0 [&>span]:transition-opacity group-hover:[&>span]:opacity-100">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-lacivert">
                  <img
                    src={t.preview.poster}
                    alt={`${t.name} örneği`}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                    {t.category}
                  </span>
                  <span className="absolute right-2 bottom-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-gok shadow">
                    <svg aria-hidden viewBox="0 0 24 24" className="ml-0.5 h-4 w-4">
                      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                    </svg>
                    <span className="sr-only">Örneği izleyin</span>
                  </span>
                </div>
              </VizorCercevesi>
            </Link>
            <div className="flex flex-1 flex-col px-2.5 pt-2">
              <div className="leading-snug font-bold">{t.name}</div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-gri sm:text-sm">{t.tagline}</p>
              <dl className="mt-3 mb-4 border-t border-ayrac pt-2 text-[13px] sm:text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gri">Süre</dt>
                  <dd className="font-semibold tabular-nums">{t.duration}</dd>
                </div>
              </dl>
              <Link
                href={createHref(t.id)}
                className="mt-auto inline-flex h-11 items-center justify-center rounded-full bg-gok px-4 text-sm font-bold text-white transition-colors hover:bg-gok-koyu"
              >
                Oluşturun
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {sablonlar.length === 0 && <p className="mt-2 text-center font-semibold text-gri">Bu kategorideki şablonlar çok yakında.</p>}
      {yakinda.length > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-ayrac bg-white/60 p-4 sm:p-5">
          <div className="text-sm font-bold text-gri">Yakında geliyor</div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {yakinda.map((t) => {
              return (
                <li key={t.slug} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-full border border-ayrac px-2 py-0.5 text-[11px] font-bold text-gri">{t.category}</span>
                  <div>
                    <div className="leading-snug font-bold">{t.name}</div>
                    <p className="text-[13px] leading-snug text-gri sm:text-sm">{t.tagline}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
