/**
 * Alt sayfaların üst bölümü: ana sayfa hero'suyla aynı lacivert bant ve bulanık drone karesi, daha kısa.
 * Etiket başlığın üstünde sarı tek satır (hangi sayfada olunduğu); başlık, açıklama ve isteğe bağlı düğmeler sola hizalı.
 */
export function PageHero({
  etiket,
  title,
  text,
  children,
}: {
  etiket: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate -mt-[76px] mb-12 overflow-hidden bg-lacivert pt-[76px] text-white md:mb-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/media/ornek-reel-poster.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#0d1b3e_25%,rgba(13,27,62,.7))]" />
      <div className="mx-auto max-w-[1240px] px-4 pt-10 pb-12 sm:px-6 md:pt-14 md:pb-16">
        <p className="text-[0.9375rem] font-semibold text-gunes">{etiket}</p>
        <h1 className="mt-3 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] leading-[1.03] font-extrabold tracking-[-0.04em] text-balance">
          {title}
        </h1>
        {text && <p className="mt-5 max-w-2xl text-[1.125rem] leading-relaxed text-[#c3cce0]">{text}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
