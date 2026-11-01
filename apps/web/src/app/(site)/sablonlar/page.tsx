import { SOON_TEMPLATES } from "@arsa/shared";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SonCagri } from "@/components/site/SonCagri";
import { SablonVitrini } from "@/components/templates/SablonVitrini";
import { SoonCard } from "@/components/templates/TemplateCard";
import { creditLabelsSafe } from "@/lib/credits";
import { tutorials } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Şablonlar",
  description: "Arsa, konut ve proje ilanları için video şablonları: şablonu seçin, bilgileri girin, video birkaç dakikada hazır.",
  alternates: { canonical: "/sablonlar" },
};

// Kredi değerleri yönetici panelinden değişir.
export const revalidate = 600;

export default async function Page() {
  const credits = await creditLabelsSafe();
  return (
    <>
      <PageHero
        etiket="Şablonlar"
        title="Şablonu seçin, hemen oluşturun"
        text="Her şablonun altında son çıktılarımızdan örnekler var. Beğendiğinizi seçin; gereken bilgileri o şablon sorar, video birkaç dakikada hazır olur."
      />
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <SablonVitrini credits={credits} howTo={tutorials.map((x) => x.template.id)} />
        {SOON_TEMPLATES.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-extrabold tracking-[-0.02em]">Yakında</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SOON_TEMPLATES.map((t) => (
                <SoonCard key={t.slug} t={t} tone="light" />
              ))}
            </ul>
          </div>
        )}
      </section>
      <SonCagri />
    </>
  );
}
