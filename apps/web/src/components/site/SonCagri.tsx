import Link from "next/link";

/** Sayfa sonu çağrısı: ana sayfa ve alt sayfalar. */
export function SonCagri() {
  return (
    <section className="px-3 pb-20 sm:px-4">
      <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] bg-lacivert px-6 py-14 text-center text-white sm:px-12 md:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gok/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-gunes/30 blur-3xl" />
        <h2 className="relative mx-auto max-w-2xl text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
          Satıştaki ilanınızın videosunu bugün hazırlayın.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-[1.0625rem] text-[#b9c3d9]">Şu anda ücretsiz deneyebilirsiniz.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sablonlar" className="site-btn h-14 bg-gunes px-8 text-base text-lacivert hover:bg-[#ffbf1a]">
            Hemen oluşturun
          </Link>
          <Link href="/nasil-yapilir" className="site-btn h-14 border border-white/25 px-6 text-base text-white hover:bg-white/10">
            Nasıl yapılır?
          </Link>
        </div>
      </div>
    </section>
  );
}
