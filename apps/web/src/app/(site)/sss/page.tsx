import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { SonCagri } from "@/components/site/SonCagri";
import { sss } from "@/lib/sss";

export const metadata: Metadata = {
  title: "Sık sorulanlar",
  description: "Parsel dosyası, video süresi, kullanım yerleri ve ücret: Arsa Video hakkında sık sorulan sorular.",
  alternates: { canonical: "/sss" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: sss.map((q) => ({ "@type": "Question", name: q.s, acceptedAnswer: { "@type": "Answer", text: q.c } })),
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        etiket="Yardım"
        title="Sık sorulanlar"
        text="Parsel dosyası, süre, kullanım yerleri ve ücret hakkında kısa cevaplar."
      />
      <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <div className="max-w-[860px]">
          <div className="border-b border-ayrac">
            {sss.map((q, i) => (
              <details key={q.s} open={i === 0} className="group border-t border-ayrac">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.125rem] font-bold hover:text-gok [&::-webkit-details-marker]:hidden">
                  {q.s}
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ayrac text-xl leading-none text-gok transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[64ch] pb-5 text-[1.0625rem] leading-relaxed text-gri">{q.c}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-gri">
            Başka bir sorunuz mu var?{" "}
            <Link href="/iletisim" className="font-bold text-gok underline-offset-4 hover:underline">
              Bize yazın
            </Link>
          </p>
        </div>
      </section>
      <SonCagri />
    </>
  );
}
