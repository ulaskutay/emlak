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
          : "bg-gok text-white"
        : tone === "dark"
          ? "border border-white/20 text-[#c9d0c6] hover:border-white/50"
          : "border border-ayrac bg-white text-gri hover:border-gok hover:text-gok"
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
        <p className={`mt-8 ${tone === "dark" ? "text-[#c9d0c6]" : "text-gri"}`}>Bu kategoride şablonlar yakında.</p>
      )}
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {live.map((t, i) => (
          <div key={t.id} className={`flex flex-col ${tone === "light" ? "site-kart p-2.5 pb-4" : ""}`}>
            <TemplateCard t={t} href={`${hrefBase}${t.id}`} tone={tone} priority={i < 4} />
            {cta && (
              <div className={`mt-auto flex flex-col items-start gap-2 pt-4 ${tone === "light" ? "px-1.5" : ""}`}>
                <Link
                  href={createHref(t.id)}
                  className={tone === "dark" ? "site-btn h-10 w-full bg-sari px-3 text-sm text-murekkep hover:bg-[#ffb21a]" : "site-btn-primary h-10 w-full px-3 text-sm"}
                >
                  Hemen oluşturun
                </Link>
                {howTo.includes(t.id) && (
                  <a
                    href={`/nasil-yapilir#nasil-tab-${t.id}`}
                    className={`self-center text-sm font-semibold underline-offset-4 hover:underline ${tone === "dark" ? "text-[#c9d0c6]" : "text-gok"}`}
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
        <div className={`mt-12 border-t pt-6 ${tone === "dark" ? "border-white/10" : "border-ayrac"}`}>
          <h3 className={`text-lg font-bold ${tone === "dark" ? "font-display text-kagit" : "text-lacivert"}`}>Yakında</h3>
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
