import type { Metadata } from "next";
import Link from "next/link";
import { DroneAnlatim } from "@/components/site/DroneAnlatim";
import { KonutAnlatim, ProjeAnlatim } from "@/components/site/SablonAnlatimlari";
import { HeroVizor } from "@/components/site/HeroVizor";
import { SablonKatalogu } from "@/components/site/SablonKatalogu";
import { SonCagri } from "@/components/site/SonCagri";
import { VideoTile } from "@/components/site/VideoTile";
import { VizorCercevesi } from "@/components/site/VizorCercevesi";
import { ornekAdi, sablonOrnekleri, digerOrnekler } from "@/lib/ornekler";
import { site } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description: site.description,
  url: site.url,
  inLanguage: "tr",
};

const ADIMLAR = [
  { baslik: "Şablonu seçin", text: "Arsa, konut ya da proje: ilanınıza uyan video türünü seçin, örneğini önceden izleyin." },
  { baslik: "Bilgileri girin", text: "Parsel dosyası ya da fotoğraflar, fiyat ve telefon. Formu şablonun kendisi adım adım sorar." },
  { baslik: "Videoyu paylaşın", text: "Birkaç dakikada panelinizde. Reels, TikTok, Shorts ve ilan sitelerine hazır dikey video." },
];

const KARSILASTIRMA = [
  { konu: "Hazırlık", ekip: "Çekim günü ve drone izni ayarlanır", biz: "Şablonu seçip bilgileri girersiniz" },
  { konu: "Hava", ekip: "Uçuş için uygun hava beklenir", biz: "Uydu görüntüsü ve fotoğraflarla çalışır, hava beklenmez" },
  { konu: "Kurgu ve ses", ekip: "Ayrı bir iş olarak yaptırılır", biz: "Kamera hareketi, yazılar, seslendirme ve müzik hazır gelir" },
  { konu: "Teslim", ekip: "Bir ilan için günler geçer", biz: "Video birkaç dakikada panelinizde olur" },
];

export default function Home() {
  const serit = [...sablonOrnekleri.filter((o) => o.src), ...digerOrnekler];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <HeroVizor />

      {/* Örnek videolar şeridi */}
      <section className="overflow-hidden bg-white py-20 md:py-24">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-6 px-4 sm:px-6">
          <div>
            <h2 className="max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
              Arsa Video ile hazırlanan videolar
            </h2>
            <p className="mt-3 max-w-xl text-[1.0625rem] text-gri">Hepsi ilan sitelerine ve sosyal medyaya uygun dikey videolar.</p>
          </div>
          <Link href="/ornekler" className="site-btn-secondary">
            Tüm örnekler
          </Link>
        </div>
        <div className="mt-12">
          <div className="serit flex w-max gap-4 px-4">
            {[...serit, ...serit].map((o, i) => (
              <VideoTile
                key={i}
                src={o.src}
                poster={o.poster}
                label={ornekAdi(o)}
                className="w-[170px] sm:w-[200px]"
              />
            ))}
          </div>
        </div>
      </section>

      <div className="pt-20 md:pt-28">
        <DroneAnlatim />
        <KonutAnlatim />
        <ProjeAnlatim />
      </div>

      <SablonKatalogu />

      {/* Üç adım: başlık solda, adımlar künye çizgisi üstünde yan yana */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <h2 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">Üç adımda hazır</h2>
          <p className="mt-4 max-w-sm text-[1.0625rem] leading-relaxed text-gri">Hangi şablonu seçerseniz seçin, video aynı sırayla hazırlanır.</p>
          <Link href="/nasil-yapilir" className="mt-6 inline-block font-bold text-gok underline-offset-4 hover:underline">
            Panelde nasıl hazırlandığını izleyin
          </Link>
        </div>
        <ol className="grid gap-x-8 sm:grid-cols-3">
          {ADIMLAR.map((a, i) => (
            <li key={a.baslik} className="border-t border-ayrac pt-5 pb-8 sm:pb-0">
              <span className="block text-[2.5rem] leading-none font-extrabold text-gok tabular-nums">{i + 1}</span>
              <h3 className="mt-5 text-xl font-extrabold tracking-[-0.02em]">{a.baslik}</h3>
              <p className="mt-2 leading-relaxed text-gri">{a.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Çekim ekibi ile karşılaştırma: iki künye yan yana, Arsa Video tarafı vizörde */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <h2 className="max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
          Aynı ilan, iki yol
        </h2>
        <div className="mt-10 grid items-start gap-6 md:grid-cols-2 md:gap-8">
          <div className="px-2.5 pt-2.5">
            <h3 className="text-xl font-extrabold text-gri">Çekim ekibiyle</h3>
            <dl className="mt-5 border-b border-ayrac">
              {KARSILASTIRMA.map((k) => (
                <div key={k.konu} className="border-t border-ayrac py-4">
                  <dt className="text-sm text-gri/80">{k.konu}</dt>
                  <dd className="mt-0.5 text-[1.0625rem] text-gri">{k.ekip}</dd>
                </div>
              ))}
            </dl>
          </div>
          <VizorCercevesi>
            <div className="rounded-xl bg-white p-5 shadow-[0_30px_60px_-34px_rgba(13,27,62,.45)] sm:p-6">
              <h3 className="text-xl font-extrabold">Arsa Video ile</h3>
              <dl className="mt-5">
                {KARSILASTIRMA.map((k) => (
                  <div key={k.konu} className="border-t border-ayrac py-4 last:pb-0">
                    <dt className="text-sm text-gri">{k.konu}</dt>
                    <dd className="mt-0.5 text-[1.0625rem] font-semibold">{k.biz}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </VizorCercevesi>
        </div>
      </section>

      <SonCagri />
    </>
  );
}
