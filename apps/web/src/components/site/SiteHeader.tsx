import Link from "next/link";
import { nav } from "@/lib/site";
import { SiteLogo } from "./SiteLogo";

/** Üst menü: koyu cam hap; ana sayfada tam ekran videonun, alt sayfalarda lacivert bandın üstünde süzülür. Mobilde açılır liste. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 rounded-full border border-white/12 bg-lacivert/70 pr-2 pl-5 text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,.6)] backdrop-blur-md sm:pr-2.5">
        <Link href="/" aria-label="Arsa Video ana sayfa" className="text-white">
          <SiteLogo />
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 text-[0.9375rem] font-semibold lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/giris" className="rounded-full px-4 py-2 text-[0.9375rem] font-bold text-white hover:text-gunes">
            Giriş
          </Link>
          <Link href="/sablonlar" className="site-btn h-11 bg-gunes text-lacivert hover:bg-[#ffbf1a]">
            Hemen oluşturun
          </Link>
        </div>

        {/* Mobil menü: JavaScript gerektirmez */}
        <details className="group lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-open:hidden" />
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="hidden group-open:block" />
            </svg>
            <span className="group-open:hidden">Menü</span>
            <span className="hidden group-open:inline">Kapat</span>
          </summary>
          <div className="absolute inset-x-3 top-[4.75rem] rounded-3xl border border-white/12 bg-lacivert p-3 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:inset-x-4">
            <nav aria-label="Mobil menü" className="flex flex-col">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-2xl px-4 py-3 text-base font-semibold hover:bg-white/10">
                  {n.label}
                </Link>
              ))}
              <Link href="/giris" className="rounded-2xl px-4 py-3 text-base font-semibold hover:bg-white/10">
                Giriş
              </Link>
              <Link href="/sablonlar" className="site-btn mt-2 w-full bg-gunes text-lacivert hover:bg-[#ffbf1a]">
                Hemen oluşturun
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
