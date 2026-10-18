import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Şablonlar · Arsa Video", template: "%s · Arsa Video" },
  description: site.description,
  openGraph: { type: "website", locale: "tr_TR", siteName: site.name },
};

/** Galeri sayfaları: koyu "Gece" zemin, aynı üst menü ve alt bilgi. */
export default function GaleriLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site site-koyu flex min-h-dvh flex-col bg-gece font-body text-kagit">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sari focus:px-4 focus:py-2 focus:text-murekkep"
      >
        İçeriğe geç
      </a>
      <SiteHeader tone="dark" />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <div className="border-t border-white/10">
        <SiteFooter />
      </div>
    </div>
  );
}
