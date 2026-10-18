import Link from "next/link";
import { legal, nav, site } from "@/lib/site";
import { SiteLogo } from "./SiteLogo";

export function SiteFooter() {
  return (
    <footer className="bg-gece text-[#c9d0c6]">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <SiteLogo tone="dark" className="text-kagit" />
          <p className="mt-4 text-[0.9375rem] leading-relaxed">{site.description}</p>
          <a href={`mailto:${site.email}`} className="mt-4 inline-block text-kagit underline-offset-4 hover:underline">
            {site.email}
          </a>
        </div>
        <nav aria-label="Site">
          <h2 className="mb-3 font-display text-base font-semibold text-kagit">Site</h2>
          <ul className="space-y-2 text-[0.9375rem]">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-kagit">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/giris" className="hover:text-kagit">
                Giriş
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Yasal">
          <h2 className="mb-3 font-display text-base font-semibold text-kagit">Yasal</h2>
          <ul className="space-y-2 text-[0.9375rem]">
            {legal.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-kagit">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1240px] px-4 py-5 text-sm text-[#8f988c] sm:px-6">
          © {new Date().getFullYear()} {site.company.title}. Videolardaki uydu ve 3D görüntüler © Google.
        </p>
      </div>
    </footer>
  );
}
