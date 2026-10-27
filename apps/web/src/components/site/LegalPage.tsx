/** Yasal metinler için ortak sayfa iskeleti. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[1240px] px-4 pt-8 pb-24 sm:px-6 md:pt-16">
      <h1 className="text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.035em]">{title}</h1>
      <p className="mt-4 text-sm text-gri">Son güncelleme: {updated}</p>
      <div className="site-kart mt-10 max-w-[80ch] space-y-5 p-6 text-[1.0625rem] leading-relaxed sm:p-10 [&_a]:font-semibold [&_a]:text-gok [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:text-[1.5rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
