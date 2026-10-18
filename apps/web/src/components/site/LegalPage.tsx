/** Yasal metinler için ortak sayfa iskeleti. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[1240px] px-4 pt-8 pb-24 sm:px-6 md:pt-16">
      <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 text-sm text-soluk">Son güncelleme: {updated}</p>
      <div className="mt-10 max-w-[68ch] space-y-5 text-[1.0625rem] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-[1.5rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
