import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SonCagri } from "@/components/site/SonCagri";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { tutorials } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Şablonlar",
  description: "Arsa, konut ve proje ilanları için video şablonları: şablonu seçin, bilgileri girin, video birkaç dakikada hazır.",
  alternates: { canonical: "/sablonlar" },
};

export default function Page() {
  return (
    <>
      <PageHero
        etiket="Şablonlar"
        title="Şablonu seçin, hemen oluşturun"
        text={'Kartın üzerine gelince örnek video oynar. "Hemen oluşturun" sizi doğrudan o şablonun formuna götürür; hesabınız yoksa önce kısa bir kayıt açılır.'}
      />
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <TemplateGallery tone="light" cta howTo={tutorials.map((x) => x.template.id)} />
      </section>
      <SonCagri />
    </>
  );
}
