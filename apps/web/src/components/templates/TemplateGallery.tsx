"use client";
import { SOON_TEMPLATES, TEMPLATE_CATEGORIES, templateList, type TemplateCategory } from "@arsa/shared";
import { useState } from "react";
import { SoonCard, TemplateCard } from "./TemplateCard";

/** Kategori düğmeli şablon ızgarası; "Yakında" şablonlar sonda. */
export function TemplateGallery({
  tone = "dark",
  hrefBase = "/sablonlar/",
  showSoon = true,
}: {
  tone?: "light" | "dark";
  /** Kart bağlantısının öneki: sitede şablon sayfası, panelde sipariş formu. */
  hrefBase?: string;
  showSoon?: boolean;
}) {
  const [cat, setCat] = useState<TemplateCategory | null>(null);
  const live = templateList.filter((t) => !cat || t.category === cat);
  const soon = showSoon ? SOON_TEMPLATES.filter((t) => !cat || t.category === cat) : [];
  const chip = (on: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      on
        ? tone === "dark"
          ? "bg-kagit text-murekkep"
          : "bg-murekkep text-kagit"
        : tone === "dark"
          ? "border border-white/20 text-[#c9d0c6] hover:border-white/50"
          : "border border-sinir text-soluk hover:border-murekkep hover:text-murekkep"
    }`;

  return (
    <div>
      <div role="group" aria-label="Kategori" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={cat === null} className={chip(cat === null)} onClick={() => setCat(null)}>
          Tümü
        </button>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} className={chip(cat === c)} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      {live.length === 0 && (
        <p className={`mt-8 ${tone === "dark" ? "text-[#c9d0c6]" : "text-soluk"}`}>Bu kategoride şablonlar yakında.</p>
      )}
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {live.map((t, i) => (
          <TemplateCard key={t.id} t={t} href={`${hrefBase}${t.id}`} tone={tone} priority={i < 4} />
        ))}
      </div>
      {soon.length > 0 && (
        <div className={`mt-12 border-t pt-6 ${tone === "dark" ? "border-white/10" : "border-sinir"}`}>
          <h3 className={`font-display text-lg font-semibold ${tone === "dark" ? "text-kagit" : "text-murekkep"}`}>Yakında</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {soon.map((t) => (
              <SoonCard key={t.slug} t={t} tone={tone} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
