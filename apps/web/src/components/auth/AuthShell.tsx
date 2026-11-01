import { templateList } from "@arsa/shared";
import Link from "next/link";
import { SiteLogo } from "../site/SiteLogo";
import { AuthVitrin } from "./AuthVitrin";

/** ?sonra=/panel/yeni/{id} ile gelindiyse o şablon. */
export function chosenTemplate(next?: string) {
  const id = next?.match(/^\/panel\/yeni\/([\w-]+)$/)?.[1];
  return templateList.find((t) => t.id === id);
}

/**
 * Giriş, kayıt ve şifre sayfalarının ortak düzeni: solda form, geniş ekranda sağda şablon vitrini.
 * Mobilde vitrin yerine formun altında küçük, yatay kayan şablon şeridi.
 */
export function AuthShell({ next, children }: { next?: string; children: React.ReactNode }) {
  const chosen = chosenTemplate(next);
  return (
    <div className="site min-h-dvh bg-zemin font-site text-lacivert lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-2 lg:p-3">
      <div className="flex min-h-dvh flex-col px-5 pt-5 pb-6 sm:px-10 lg:min-h-[calc(100dvh-1.5rem)] lg:pt-4">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Arsa Video ana sayfa">
            <SiteLogo />
          </Link>
          <Link href="/sablonlar" className="rounded-full px-3 py-2 text-sm font-bold text-gri hover:text-gok">
            Şablonlar
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10">
          {chosen && (
            <div className="mb-7 flex items-center gap-3 rounded-2xl border border-ayrac bg-white p-2.5 pr-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chosen.preview.poster} alt="" className="h-14 w-12 shrink-0 rounded-xl object-cover" />
              <p className="text-sm leading-snug text-gri">
                Seçtiğiniz şablon
                <span className="block text-[0.9375rem] font-extrabold text-lacivert">{chosen.name}</span>
              </p>
            </div>
          )}
          {children}
        </main>

        <section aria-label="Hazırlayabileceğiniz videolar" className="-mx-5 mb-6 sm:-mx-10 lg:hidden">
          <p className="px-5 text-sm font-bold text-gri sm:px-10">Hazırlayabileceğiniz videolar</p>
          <ul className="mt-3 flex snap-x scroll-px-5 gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:scroll-px-10">
            {templateList.map((t) => (
              <li key={t.id} className="w-32 shrink-0 snap-start first:ml-5 last:mr-5 sm:first:ml-10 sm:last:mr-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.preview.poster} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-2xl bg-gok-acik object-cover" />
                <p className="mt-1.5 text-[0.8125rem] leading-tight font-bold">{t.name}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] text-gri">
          <span>© Arsa Video</span>
          <Link href="/kullanim-kosullari" className="hover:text-gok">Kullanım koşulları</Link>
          <Link href="/kvkk" className="hover:text-gok">KVKK</Link>
          <Link href="/gizlilik" className="hover:text-gok">Gizlilik</Link>
          <Link href="/iletisim" className="hover:text-gok">İletişim</Link>
        </footer>
      </div>

      <aside className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] lg:block">
        <AuthVitrin templates={templateList} fixed={chosen?.id} />
      </aside>
    </div>
  );
}
