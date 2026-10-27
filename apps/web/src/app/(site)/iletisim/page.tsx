import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { VizorCercevesi } from "@/components/site/VizorCercevesi";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Arsa Video hakkında soru, öneri ve kurumsal kullanım için bize yazın.",
  alternates: { canonical: "/iletisim" },
};

export default function Page() {
  return (
    <>
      <PageHero
        etiket="İletişim"
        title="Bize yazın"
        text="Videonuzla ilgili bir sorun, bir öneri ya da ofisiniz için toplu kullanım isteği: e-postayla yazın, size dönelim."
      />
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <VizorCercevesi className="max-w-2xl">
          <dl className="rounded-xl bg-white p-6 text-[1.0625rem] shadow-[0_30px_60px_-34px_rgba(13,27,62,.45)] sm:p-8">
            <dt className="text-sm text-gri">E-posta</dt>
            <dd className="mt-1">
              <a href={`mailto:${site.email}`} className="text-2xl font-extrabold text-gok underline-offset-4 hover:underline">
                {site.email}
              </a>
            </dd>
            <dt className="mt-6 border-t border-ayrac pt-6 text-sm text-gri">Videonuzla ilgili yazıyorsanız</dt>
            <dd className="mt-1 leading-relaxed">
              Panelde video sayfasının adresini e-postanıza ekleyin; hangi videodan söz ettiğinizi hemen buluruz.
            </dd>
            <dt className="mt-6 border-t border-ayrac pt-6 text-sm text-gri">Henüz hesabınız yoksa</dt>
            <dd className="mt-1">
              <Link href="/kayit" className="font-bold text-gok underline underline-offset-4">
                Ücretsiz hesap açın
              </Link>
            </dd>
          </dl>
        </VizorCercevesi>
      </section>
    </>
  );
}
