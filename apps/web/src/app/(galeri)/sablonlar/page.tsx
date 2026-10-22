import type { Metadata } from "next";
import { TemplateGallery } from "@/components/templates/TemplateGallery";

export const metadata: Metadata = {
  title: "Şablonlar",
  description: "Arsa, konut ve proje ilanları için video şablonları: şablonu seçin, bilgileri girin, video birkaç dakikada hazır.",
  alternates: { canonical: "/sablonlar" },
};

export default function Page() {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pt-8 pb-24 sm:px-6 md:pt-14">
      <h1 className="max-w-3xl font-display text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98] font-bold tracking-[-0.035em] text-balance">
        Şablonu seçin, gerisini biz çekelim.
      </h1>
      <p className="mt-5 max-w-xl text-[1.125rem] leading-relaxed text-[#c9d0c6]">
        Her şablon bir video türü: hangi bilgileri isteyeceğini ve videoda neler olacağını şablon sayfasında görürsünüz.
      </p>
      <div className="mt-12">
        <TemplateGallery tone="dark" />
      </div>
    </section>
  );
}
