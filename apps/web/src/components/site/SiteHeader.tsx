import Link from "next/link";
import { nav } from "@/lib/site";
import { SiteLogo } from "./SiteLogo";

/** Üst menü: sayfanın üstünde süzülen beyaz çubuk; mobilde açılır liste. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 rounded-full border border-ayrac bg-white/90 pr-2 pl-5 shadow-[0_10px_30px_-18px_rgba(13,27,62,.35)] backdrop-blur sm:pr-2.5">
        <Link href="/" aria-label="Arsa Video ana sayfa" className="text-lacivert">
          <SiteLogo />
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 text-[0.9375rem] font-semibold lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-gri transition-colors hover:bg-gok-acik hover:text-gok">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/giris" className="rounded-full px-4 py-2 text-[0.9375rem] font-bold text-lacivert hover:text-gok">
            Giriş
          </Link>
          <Link href="/sablonlar" className="site-btn-primary h-11">
            Hemen oluşturun
          </Link>
        </div>

        {/* Mobil menü: JavaScript gerektirmez */}
        <details className="group lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full bg-gok-acik px-4 text-sm font-bold text-gok [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-open:hidden" />
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="hidden group-open:block" />
            </svg>
            <span className="group-open:hidden">Menü</span>
            <span className="hidden group-open:inline">Kapat</span>
          </summary>
          <div className="absolute inset-x-3 top-[4.75rem] rounded-3xl border border-ayrac bg-white p-3 text-lacivert shadow-[0_30px_60px_-20px_rgba(13,27,62,.35)] sm:inset-x-4">
            <nav aria-label="Mobil menü" className="flex flex-col">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-2xl px-4 py-3 text-base font-semibold hover:bg-gok-acik">
                  {n.label}
                </Link>
              ))}
              <Link href="/giris" className="rounded-2xl px-4 py-3 text-base font-semibold hover:bg-gok-acik">
                Giriş
              </Link>
              <Link href="/sablonlar" className="site-btn-primary mt-2 w-full">
                Hemen oluşturun
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
