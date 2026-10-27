import type { Metadata } from "next";
import Link from "next/link";
import { DroneAnlatim } from "@/components/site/DroneAnlatim";
import { KonutAnlatim, ProjeAnlatim } from "@/components/site/SablonAnlatimlari";
import { HeroVizor } from "@/components/site/HeroVizor";
import { SablonKatalogu } from "@/components/site/SablonKatalogu";
import { SonCagri } from "@/components/site/SonCagri";
import { VideoTile } from "@/components/site/VideoTile";
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
  { ikon: "🧩", baslik: "Şablonu seçin", text: "Arsa, konut ya da proje: ilanınıza uyan video türünü seçin, örneğini önceden izleyin." },
  { ikon: "✍️", baslik: "Bilgileri girin", text: "Parsel dosyası ya da fotoğraflar, fiyat ve telefon. Formu şablonun kendisi adım adım sorar." },
  { ikon: "🎬", baslik: "Videoyu paylaşın", text: "Birkaç dakikada panelinizde. Reels, TikTok, Shorts ve ilan sitelerine hazır dikey video." },
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

      {/* Üç adım */}
      <section className="mx-auto max-w-[1240px] px-4 py-24 sm:px-6">
        <div className="text-center">
          <span className="site-etiket">Nasıl çalışır</span>
          <h2 className="mx-auto mt-4 max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
            Üç adımda hazır
          </h2>
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {ADIMLAR.map((a, i) => (
            <li key={a.baslik} className="site-kart relative p-7">
              <span className="absolute top-6 right-7 text-5xl font-extrabold text-gok/10 tabular-nums">{i + 1}</span>
              <span aria-hidden className="grid h-14 w-14 place-items-center rounded-2xl bg-gok-acik text-2xl">
                {a.ikon}
              </span>
              <h3 className="mt-5 text-xl font-extrabold tracking-[-0.02em]">{a.baslik}</h3>
              <p className="mt-2 leading-relaxed text-gri">{a.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/nasil-yapilir" className="font-bold text-gok underline-offset-4 hover:underline">
            Her şablonun panelde nasıl hazırlandığını izleyin →
          </Link>
        </div>
      </section>

      {/* Çekim ekibi ile karşılaştırma */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-ayrac bg-white/60 p-7 sm:p-9">
            <h3 className="text-xl font-extrabold text-gri">Çekim ekibiyle</h3>
            <ul className="mt-6 space-y-4 text-[1.0625rem] text-gri">
              {["Çekim gününü ve drone iznini ayarlarsınız", "Havanın uygun olmasını beklersiniz", "Kurgu ve seslendirme ayrı bir iş olur", "Bir ilan için günler geçer"].map(
                (x) => (
                  <li key={x} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ayrac text-sm">
                      ✕
                    </span>
                    {x}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="rounded-3xl bg-gok p-7 text-white shadow-[0_30px_60px_-30px_rgba(43,108,255,.9)] sm:p-9">
            <h3 className="text-xl font-extrabold">Arsa Video ile</h3>
            <ul className="mt-6 space-y-4 text-[1.0625rem]">
              {["Şablonu seçip bilgileri girersiniz", "Kamera hareketi, yazılar ve müzik hazır gelir", "Ofis adınız ve telefonunuz videoda yer alır", "Video birkaç dakikada panelinizde olur"].map(
                (x) => (
                  <li key={x} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gunes text-sm font-bold text-lacivert">
                      ✓
                    </span>
                    {x}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      <SonCagri />
    </>
  );
}
