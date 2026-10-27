"use client";
import { SOON_TEMPLATES, TEMPLATE_CATEGORIES, templateList, type TemplateCategory } from "@arsa/shared";
import Link from "next/link";
import { useState } from "react";
import { createHref } from "@/lib/tutorials";
import { SoonCard, TemplateCard } from "./TemplateCard";

/** Kategori düğmeli şablon ızgarası; "Yakında" şablonlar sonda. */
export function TemplateGallery({
  tone = "dark",
  hrefBase = "/sablonlar/",
  showSoon = true,
  cta = false,
  howTo = [],
}: {
  tone?: "light" | "dark";
  /** Kart bağlantısının öneki: sitede şablon sayfası, panelde sipariş formu. */
  hrefBase?: string;
  showSoon?: boolean;
  /** Kartın altında "Hemen oluşturun" düğmesi (sitede; panelde kartın kendisi formu açar). */
  cta?: boolean;
  /** "Nasıl yapılır" kaydı olan şablonlar: kartın altında o sekmeye bağlantı. */
  howTo?: string[];
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
          <div key={t.id} className="flex flex-col">
            <TemplateCard t={t} href={`${hrefBase}${t.id}`} tone={tone} priority={i < 4} />
            {cta && (
              <div className="mt-auto flex flex-col items-start gap-2 pt-4">
                <Link
                  href={createHref(t.id)}
                  className={`site-btn h-10 w-full px-3 text-sm ${
                    tone === "dark" ? "bg-sari text-murekkep hover:bg-[#ffb21a]" : "bg-murekkep text-kagit hover:bg-gece"
                  }`}
                >
                  Hemen oluşturun
                </Link>
                {howTo.includes(t.id) && (
                  <a
                    href={`#nasil-tab-${t.id}`}
                    className={`text-sm font-semibold underline-offset-4 hover:underline ${tone === "dark" ? "text-[#c9d0c6]" : "text-zeytin"}`}
                  >
                    Nasıl yapılır?
                  </a>
                )}
              </div>
            )}
          </div>
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
