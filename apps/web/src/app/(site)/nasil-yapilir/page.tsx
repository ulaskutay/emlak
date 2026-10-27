import type { Metadata } from "next";
import Link from "next/link";
import { HowTo } from "@/components/site/HowTo";
import { PageHero } from "@/components/site/PageHero";
import { SonCagri } from "@/components/site/SonCagri";
import { tutorials } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Nasıl yapılır",
  description: "Her video şablonunun panelde baştan sona nasıl hazırlandığını izleyin: hangi bilgiyi girdiğinizi ve sonunda çıkan videoyu görün.",
  alternates: { canonical: "/nasil-yapilir" },
};

export default function Page() {
  return (
    <>
      <PageHero
        etiket="Nasıl yapılır"
        title="Videonuzu nasıl hazırlayacağınızı izleyin"
        text="Her şablonu panelde baştan sona kaydettik: hangi bilgiyi girdiğinizi ve sonunda çıkan videoyu görürsünüz. Aynısını kendi ilanınızla birkaç dakikada yaparsınız."
      />
      <section className="px-3 pb-24 sm:px-4">
        <div className="site-kart mx-auto max-w-[1320px] bg-white/70 p-4 sm:p-8 lg:p-10">
          <HowTo tutorials={tutorials} />
        </div>
        <p className="mx-auto mt-8 max-w-[1240px] px-1 text-center text-gri">
          Kayıtta görmediğiniz bir şey mi var?{" "}
          <Link href="/sss" className="font-bold text-gok underline-offset-4 hover:underline">
            Sık sorulanlara
          </Link>{" "}
          bakın ya da{" "}
          <Link href="/iletisim" className="font-bold text-gok underline-offset-4 hover:underline">
            bize yazın
          </Link>
          .
        </p>
      </section>
      <SonCagri />
    </>
  );
}
