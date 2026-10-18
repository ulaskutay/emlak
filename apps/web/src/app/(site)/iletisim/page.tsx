import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Arsa Video hakkında soru, öneri ve kurumsal kullanım için bize yazın.",
  alternates: { canonical: "/iletisim" },
};

export default function Page() {
  return (
    <section className="mx-auto grid max-w-[1240px] gap-12 px-4 pt-8 pb-24 sm:px-6 md:grid-cols-2 md:pt-16">
      <div>
        <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em]">
          Bize yazın
        </h1>
        <p className="mt-6 max-w-md text-[1.125rem] leading-relaxed text-soluk">
          Videonuzla ilgili bir sorun, bir öneri ya da ofisiniz için toplu kullanım isteği: e-postayla yazın, size
          dönelim.
        </p>
      </div>
      <dl className="self-start rounded-xl border border-sinir bg-kagit p-6 text-[1.0625rem] sm:p-8">
        <dt className="text-sm text-soluk">E-posta</dt>
        <dd className="mt-1">
          <a href={`mailto:${site.email}`} className="font-display text-2xl font-semibold underline-offset-4 hover:underline">
            {site.email}
          </a>
        </dd>
        <dt className="mt-6 border-t border-cizgi pt-6 text-sm text-soluk">Videonuzla ilgili yazıyorsanız</dt>
        <dd className="mt-1 leading-relaxed">
          Panelde video sayfasının adresini e-postanıza ekleyin; hangi videodan söz ettiğinizi hemen buluruz.
        </dd>
        <dt className="mt-6 border-t border-cizgi pt-6 text-sm text-soluk">Henüz hesabınız yoksa</dt>
        <dd className="mt-1">
          <Link href="/kayit" className="font-semibold underline underline-offset-4">
            Ücretsiz hesap açın
          </Link>
        </dd>
      </dl>
    </section>
  );
}
