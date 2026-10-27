import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Başlıklar: büyük boyda dar (wdth) ve optik boyuta (opsz) göre kesilmiş Bricolage
const bricolage = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-bricolage", axes: ["opsz", "wdth"] });
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-instrument" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Arsa Video",
  description: "Emlak için şablonlu tanıtım videoları",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${bricolage.variable} ${instrument.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
