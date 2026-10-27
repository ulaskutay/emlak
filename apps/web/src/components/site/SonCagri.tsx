import Link from "next/link";
import { VizorCercevesi } from "./VizorCercevesi";

/** Sayfa sonu çağrısı: ana sayfa ve alt sayfalar. Hero'yla aynı dil: lacivert bant, bulanık drone karesi, vizörde çağrı. */
export function SonCagri() {
  return (
    <section className="px-3 pb-20 sm:px-4">
      <div className="relative isolate mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] bg-lacivert px-4 py-10 text-center text-white sm:px-10 md:py-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/ornek-reel-poster.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(13,27,62,.6),#0d1b3e_75%)]" />
        <VizorCercevesi className="mx-auto max-w-3xl px-6 py-10 sm:px-12 md:py-14">
          <h2 className="mx-auto max-w-2xl text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
            Satıştaki ilanınızın videosunu bugün hazırlayın.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] text-[#c3cce0]">Şu anda ücretsiz deneyebilirsiniz.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/sablonlar" className="site-btn h-14 bg-gunes px-8 text-base text-lacivert hover:bg-[#ffbf1a]">
              Hemen oluşturun
            </Link>
            <Link href="/nasil-yapilir" className="site-btn h-14 border border-white/25 px-6 text-base text-white hover:bg-white/10">
              Nasıl yapılır?
            </Link>
          </div>
        </VizorCercevesi>
      </div>
    </section>
  );
}
