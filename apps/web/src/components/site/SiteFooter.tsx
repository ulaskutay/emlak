import Link from "next/link";
import { templateList } from "@arsa/shared";
import { legal, nav, site } from "@/lib/site";
import { SiteLogo } from "./SiteLogo";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-lacivert text-[#b9c3d9]">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <SiteLogo className="text-white" />
          <p className="mt-4 text-[0.9375rem] leading-relaxed">{site.description}</p>
          <a href={`mailto:${site.email}`} className="mt-4 inline-block font-semibold text-white underline-offset-4 hover:underline">
            {site.email}
          </a>
        </div>
        <nav aria-label="Şablonlar">
          <h2 className="mb-3 text-base font-bold text-white">Şablonlar</h2>
          <ul className="space-y-2 text-[0.9375rem]">
            {templateList.map((t) => (
              <li key={t.id}>
                <Link href={`/sablonlar/${t.id}`} className="hover:text-white">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Site">
          <h2 className="mb-3 text-base font-bold text-white">Site</h2>
          <ul className="space-y-2 text-[0.9375rem]">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/giris" className="hover:text-white">
                Giriş
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Yasal">
          <h2 className="mb-3 text-base font-bold text-white">Yasal</h2>
          <ul className="space-y-2 text-[0.9375rem]">
            {legal.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1240px] px-4 py-5 text-sm text-[#8794b0] sm:px-6">
          © {new Date().getFullYear()} {site.company.title}. Videolardaki uydu ve 3D görüntüler © Google.
        </p>
      </div>
    </footer>
  );
}
