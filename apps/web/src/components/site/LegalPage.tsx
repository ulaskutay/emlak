import { PageHero } from "./PageHero";

/** Yasal metinler için ortak sayfa iskeleti: diğer alt sayfalarla aynı üst bant, altında okunur genişlikte metin. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero etiket="Yasal" title={title} text={`Son güncelleme: ${updated}`} />
      <article className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <div className="max-w-[80ch] space-y-5 text-[1.0625rem] leading-relaxed [&_a]:font-semibold [&_a]:text-gok [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-ayrac [&_h2]:pt-8 [&_h2]:text-[1.5rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </>
  );
}
