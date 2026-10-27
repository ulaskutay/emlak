import type { Metadata } from "next";
import Link from "next/link";
import { TEMPLATE_CATEGORIES, templateList, type TemplateCategory } from "@arsa/shared";
import { ArsaDrone } from "@/components/site/ArsaDrone";
import { HeroPhones } from "@/components/site/HeroPhones";
import { SonCagri } from "@/components/site/SonCagri";
import { VideoTile } from "@/components/site/VideoTile";
import { ornekAdi, sablonOrnekleri, digerOrnekler } from "@/lib/ornekler";
import { site } from "@/lib/site";
import { createHref } from "@/lib/tutorials";

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

/** Kategori kartlarının renkleri ve tek cümlelik açıklamaları. */
const KATEGORI: Record<TemplateCategory, { ikon: string; text: string; renk: string; zemin: string }> = {
  Arsa: { ikon: "🛰️", text: "Ada/parsel dosyasından havadan tanıtım; arsaya gitmeden.", renk: "text-gok", zemin: "bg-gok-acik" },
  Konut: { ikon: "🏡", text: "İlan fotoğraflarından sinematik tur, döşeme ve sunuculu anlatım.", renk: "text-mercan", zemin: "bg-mercan-acik" },
  Proje: { ikon: "🏗️", text: "Boş arsadan yükselen binayı gösteren inşaat videoları.", renk: "text-[#b7860b]", zemin: "bg-gunes-acik" },
  "Sosyal medya": { ikon: "📣", text: "Satıldı ve fiyat güncellemesi gibi kısa paylaşımlar.", renk: "text-cimen", zemin: "bg-cimen-acik" },
};

const ADIMLAR = [
  { ikon: "🧩", baslik: "Şablonu seçin", text: "Arsa, konut ya da proje: ilanınıza uyan video türünü seçin, örneğini önceden izleyin." },
  { ikon: "✍️", baslik: "Bilgileri girin", text: "Parsel dosyası ya da fotoğraflar, fiyat ve telefon. Formu şablonun kendisi adım adım sorar." },
  { ikon: "🎬", baslik: "Videoyu paylaşın", text: "Birkaç dakikada panelinizde. Reels, TikTok, Shorts ve ilan sitelerine hazır dikey video." },
];

export default function Home() {
  const kategoriler = TEMPLATE_CATEGORIES.map((k) => ({ k, sablonlar: templateList.filter((t) => t.category === k) })).filter(
    (x) => x.sablonlar.length > 0,
  );
  const serit = [...sablonOrnekleri.filter((o) => o.src), ...digerOrnekler];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full bg-gok/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-32 h-[420px] w-[420px] rounded-full bg-gunes/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-4 pt-12 pb-20 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
          <div className="text-center lg:text-left">
            <span className="site-etiket">
              <span aria-hidden>🚁</span> Drone uçurmadan, çekim ekibi olmadan
            </span>
            <h1 className="mt-6 text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
              İlanınızın videosu{" "}
              <span className="relative whitespace-nowrap text-gok">
                dakikalar içinde
                <svg aria-hidden viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-gunes">
                  <path d="M3 10C80 3 210 2 297 8" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
                </svg>
              </span>{" "}
              hazır.
            </h1>
            <p className="mx-auto mt-7 max-w-[34rem] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-relaxed text-gri lg:mx-0">
              Parsel dosyanızı ya da ilan fotoğraflarınızı yükleyin; seslendirmeli, müzikli, dikey tanıtım videonuz panelinize
              gelsin.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/sablonlar" className="site-btn-primary h-14 px-8 text-base">
                Hemen oluşturun
              </Link>
              <Link href="/nasil-yapilir" className="site-btn-secondary h-14 px-6 text-base">
                <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-gok-acik text-gok">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5">
                    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                  </svg>
                </span>
                Nasıl yapılır izleyin
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.9375rem] font-semibold text-gri lg:justify-start">
              {["Reels, TikTok ve Shorts için 9:16", "Türkçe seslendirme ve altyazı", "Ofis adınız ve telefonunuz videoda"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-cimen-acik text-xs text-cimen">
                    ✓
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <HeroPhones />
        </div>
      </section>

      {/* Ne tanıtmak istiyorsunuz? */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <div className="text-center">
          <span className="site-etiket">Gayrimenkul türünü seçin</span>
          <h2 className="mx-auto mt-4 max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
            Ne tanıtmak istiyorsunuz?
          </h2>
        </div>
        <div className={`mt-12 grid gap-5 ${kategoriler.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {kategoriler.map(({ k, sablonlar }) => {
            const c = KATEGORI[k];
            return (
              <div key={k} className="site-kart flex flex-col p-6 sm:p-7">
                {k === "Arsa" ? (
                  <ArsaDrone />
                ) : (
                  <span aria-hidden className={`grid h-14 w-14 place-items-center rounded-2xl text-2xl ${c.zemin}`}>
                    {c.ikon}
                  </span>
                )}
                <h3 className="mt-5 text-2xl font-extrabold tracking-[-0.03em]">{k}</h3>
                <p className="mt-2 leading-relaxed text-gri">{c.text}</p>
                <ul className="mt-5 space-y-2">
                  {sablonlar.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={createHref(t.id)}
                        className={`group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold transition-colors ${c.zemin} hover:brightness-[0.97]`}
                      >
                        <span>{t.name}</span>
                        <span className={`text-sm whitespace-nowrap ${c.renk}`}>
                          Oluşturun <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Örnek videolar şeridi */}
      <section className="overflow-hidden bg-white py-20 md:py-24">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-6 px-4 sm:px-6">
          <div>
            <span className="site-etiket">Örnekler</span>
            <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
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
