import Link from "next/link";
import { nav } from "@/lib/site";
import { SiteLogo } from "./SiteLogo";

/** Üst menü: açık (pafta) sayfalarda mürekkep, koyu (galeri) sayfalarda açık renk. */
export function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const link = dark ? "text-[#a9b2a6] hover:text-kagit" : "text-soluk hover:text-murekkep";
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Arsa Video ana sayfa" className={dark ? "text-kagit" : ""}>
          <SiteLogo tone={tone} />
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-7 text-[0.9375rem] md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`transition-colors ${link}`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link href="/giris" className={`text-[0.9375rem] font-semibold hover:underline ${dark ? "text-kagit" : "text-murekkep"}`}>
            Giriş
          </Link>
          <Link href="/kayit" className="site-btn-primary h-11">
            Ücretsiz deneyin
          </Link>
        </div>

        {/* Mobil menü: JavaScript gerektirmez */}
        <details className="group md:hidden">
          <summary
            className={`flex h-11 cursor-pointer list-none items-center rounded-xl border px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${dark ? "border-white/30 text-kagit" : "border-murekkep/80"}`}
          >
            <span className="group-open:hidden">Menü</span>
            <span className="hidden group-open:inline">Kapat</span>
          </summary>
          <div className="absolute inset-x-0 top-20 border-y border-cizgi bg-kagit px-4 py-4 text-murekkep shadow-[0_30px_60px_-20px_rgba(18,26,22,.35)]">
            <nav aria-label="Mobil menü" className="flex flex-col">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="border-b border-cizgi py-3.5 text-base">
                  {n.label}
                </Link>
              ))}
              <Link href="/giris" className="py-3.5 text-base font-semibold">
                Giriş
              </Link>
              <Link href="/kayit" className="site-btn-primary mt-2 w-full">
                Ücretsiz deneyin
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
