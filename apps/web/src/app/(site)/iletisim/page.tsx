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
    <section className="mx-auto grid max-w-[1240px] gap-12 px-4 pt-14 pb-24 sm:px-6 md:grid-cols-2 md:pt-20">
      <div>
        <span className="site-etiket">İletişim</span>
        <h1 className="mt-5 text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
          Bize yazın
        </h1>
        <p className="mt-6 max-w-md text-[1.125rem] leading-relaxed text-gri">
          Videonuzla ilgili bir sorun, bir öneri ya da ofisiniz için toplu kullanım isteği: e-postayla yazın, size
          dönelim.
        </p>
      </div>
      <dl className="site-kart self-start p-6 text-[1.0625rem] sm:p-8">
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
    </section>
  );
}
