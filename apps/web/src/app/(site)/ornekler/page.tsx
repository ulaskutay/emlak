import type { Metadata } from "next";
import Link from "next/link";
import { templateList } from "@arsa/shared";
import { PageHero } from "@/components/site/PageHero";
import { SonCagri } from "@/components/site/SonCagri";
import { VideoTile } from "@/components/site/VideoTile";
import { digerOrnekler, sablonOrnekleri } from "@/lib/ornekler";
import { createHref } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Örnekler",
  description: "Arsa Video şablonlarıyla hazırlanmış arsa drone turu, ilan, inşaat ve sunuculu ev turu videolarını izleyin.",
  alternates: { canonical: "/ornekler" },
};

export default function Page() {
  return (
    <>
      <PageHero
        etiket="Örnekler"
        title="Arsa Video ile hazırlanan videolar"
        text="Videonun üzerine gelin ya da dokunun, sessiz oynasın. Beğendiğiniz şablonla kendi ilanınızın videosunu hemen oluşturun."
      />

      <section className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Şablon başına bir örnek</h2>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
          {sablonOrnekleri.map((o) => {
            const t = templateList.find((x) => x.id === o.template)!;
            return (
              <div key={o.template} className="flex flex-col">
                <VideoTile src={o.src} poster={o.poster} label={t.name} sub={`${t.category} · ${t.duration}`} />
                <Link href={createHref(t.id)} className="site-btn-primary mx-2.5 mt-3 h-11 px-3 text-sm">
                  Hemen oluşturun
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Diğer çıktılar</h2>
          <p className="mt-2 text-gri">Aynı şablonlardan farklı ilanlar için hazırlanmış kısa bölümler.</p>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {digerOrnekler.map((o) => (
              <VideoTile key={o.poster} src={o.src} poster={o.poster} label={templateList.find((x) => x.id === o.template)!.name} />
            ))}
          </div>
        </div>
      </section>

      <div className="pt-20">
        <SonCagri />
      </div>
    </>
  );
}
