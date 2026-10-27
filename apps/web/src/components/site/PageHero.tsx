/** Alt sayfaların üst bölümü: etiket, başlık, kısa açıklama ve isteğe bağlı düğmeler. */
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
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gok/10 blur-3xl" />
      <div className="relative mx-auto max-w-[1240px] px-4 pt-14 pb-12 text-center sm:px-6 md:pt-20 md:pb-16">
        <span className="site-etiket">{etiket}</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">
          {title}
        </h1>
        {text && <p className="mx-auto mt-5 max-w-2xl text-[1.125rem] leading-relaxed text-gri">{text}</p>}
        {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </section>
  );
}
