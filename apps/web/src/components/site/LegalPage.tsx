import Link from "next/link";
import { legal, site } from "@/lib/site";
import { PageHero } from "./PageHero";

/**
 * Yasal metinler için ortak sayfa iskeleti: diğer alt sayfalarla aynı üst bant, altında okunur genişlikte metin.
 * Maddeler h2 (numarası başlıkta yazılı), alt maddeler h3; tablolar ve numaralı listeler de biçimlenir.
 * Yanda diğer yasal metinlere bağlantı ve yürürlük bilgisi durur.
 */
export function LegalPage({
  title,
  updated,
  current,
  children,
}: {
  title: string;
  updated: string;
  /** Bu sayfanın yolu: yan listede işaretlenir. */
  current: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHero etiket="Yasal" title={title} text={`Yürürlük ve son güncelleme tarihi: ${updated}`} />
      <article className="mx-auto grid max-w-[1240px] gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[minmax(0,80ch)_1fr]">
        <div className="min-w-0 space-y-5 text-[1.0625rem] leading-relaxed [&_a]:font-semibold [&_a]:text-gok [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:border-t [&_h2]:border-ayrac [&_h2]:pt-8 [&_h2]:text-[1.5rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h3]:mt-8 [&_h3]:text-[1.125rem] [&_h3]:font-bold [&_ol]:space-y-2 [&_ol>li]:ml-6 [&_ol>li]:list-decimal [&_ol>li]:pl-1 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.9375rem] [&_td]:border-t [&_td]:border-ayrac [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:border-t [&_th]:border-ayrac [&_th]:bg-zemin [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_ul]:space-y-2 [&_ul>li]:ml-5 [&_ul>li]:list-disc">
          {children}
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Yasal metinler" className="rounded-2xl border border-ayrac bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-gri">Yasal metinler</p>
            <ul className="space-y-2 text-[0.9375rem]">
              {legal.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={n.href === current ? "page" : undefined}
                    className={n.href === current ? "font-semibold text-gok" : "text-lacivert hover:text-gok"}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-ayrac pt-4 text-sm leading-relaxed text-gri">
              Sorularınız için <a href={`mailto:${site.email}`} className="font-semibold text-gok">{site.email}</a>
            </p>
          </nav>
        </aside>
      </article>
    </>
  );
}

/** Şirketin kimlik bilgileri: lib/site.ts içindeki dolu alanlar tablo olarak. */
export function CompanyDetails() {
  const c = site.company;
  const rows = [
    ["Unvan", c.title],
    ["Adres", c.address],
    ["Telefon", c.phone],
    ["E-posta", site.email],
    ["KEP adresi", c.kep],
    ["MERSİS no", c.mersis],
    ["Vergi dairesi / no", [c.taxOffice, c.taxNo].filter(Boolean).join(" / ")],
    ["İnternet sitesi", site.url.replace(/^https?:\/\//, "")],
  ].filter(([, v]) => v);
  return (
    <table>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="w-48">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
