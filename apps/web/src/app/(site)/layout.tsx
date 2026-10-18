import type { Metadata } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Arsa Video — Drone uçurmadan arsanızın drone videosu", template: "%s · Arsa Video" },
  description: site.description,
  openGraph: { type: "website", locale: "tr_TR", siteName: site.name },
};

// Çerezsiz ziyaret ölçümü (Plausible): alan adı tanımlıysa yüklenir.
const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`site flex min-h-dvh flex-col font-body text-murekkep`}>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sari focus:px-4 focus:py-2"
      >
        İçeriğe geç
      </a>
      <SiteHeader />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {plausible && (
        <Script defer data-domain={plausible} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
      )}
    </div>
  );
}
