import type { Metadata } from "next";
import Link from "next/link";
import { SOON_TEMPLATES, templateList } from "@arsa/shared";
import { HowTo } from "@/components/site/HowTo";
import { VideoWall } from "@/components/site/VideoWall";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { site } from "@/lib/site";
import { tutorials } from "@/lib/tutorials";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const sss = [
  {
    s: "Hangi videoları hazırlayabilirim?",
    c: `Şu anda ${templateList.length} şablon var: ${templateList.map((t) => t.name.toLocaleLowerCase("tr")).join(", ")}. Her birinin panelde nasıl hazırlandığını ana sayfadaki kayıtlardan izleyebilirsiniz; yeni şablonlar ekledikçe şablonlar sayfasında görünür.`,
  },
  {
    s: "Parsel dosyasını nereden alırım?",
    c: "parselsorgu.tkgm.gov.tr adresinde il, ilçe, mahalle, ada ve parseli seçin; sonuç ekranından KML ya da GeoJSON dosyasını indirin. Arsa Video'ya bu dosyayı yüklemeniz yeterli.",
  },
  {
    s: "Çekim ekibi ya da drone gerekiyor mu?",
    c: "Hayır. Arsa şablonları Google'ın uydu ve 3D harita görüntüleri üzerinde uçan sanal bir kamerayla, ilan şablonu ise elinizdeki fotoğraflardan hazırlanır. Mülke gitmeniz gerekmez.",
  },
  {
    s: "Harita görüntüleri güncel mi?",
    c: "Arsa şablonlarındaki görüntüler Google'ın harita verisinden gelir; çekim tarihi bölgeye göre birkaç yıl öncesine ait olabilir. Parsel sınırı ise doğrudan TKGM dosyanızdan çizilir.",
  },
  {
    s: "Video ne kadar sürede hazır olur?",
    c: "Siparişten sonra genellikle birkaç dakika. Aşamaları panelde canlı izlersiniz; video hazır olduğunda indirip paylaşabilirsiniz.",
  },
  {
    s: "Videoyu nerede kullanabilirim?",
    c: "Video dikey (9:16) hazırlanır: Instagram Reels, TikTok, YouTube Shorts, WhatsApp durumu ve ilan sitelerinin video alanı için uygundur.",
  },
  {
    s: "Ücreti ne kadar?",
    c: "Şu anda ücretsiz deneyebilirsiniz. Ücretli paketler yayına girmeden önce kayıtlı kullanıcılara e-postayla duyurulacak.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: site.name,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: site.description,
      url: site.url,
      inLanguage: "tr",
    },
    {
      "@type": "FAQPage",
      mainEntity: sss.map((q) => ({ "@type": "Question", name: q.s, acceptedAnswer: { "@type": "Answer", text: q.c } })),
    },
  ],
};

export default function Home() {

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: şablon çıktılarından video duvarı */}
      <section className="px-3 sm:px-4">
        <div className="relative mx-auto h-[clamp(560px,84vh,780px)] max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-gece text-kagit">
          <VideoWall />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(18,26,22,0.94)_0%,rgba(18,26,22,0.82)_45%,rgba(18,26,22,0.35)_100%)]" />
          <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
            <h1 className="max-w-4xl font-display text-[clamp(2.6rem,7vw,5.75rem)] leading-[0.95] font-bold tracking-[-0.035em] text-balance">
              İlanınızı videoya çeviren şablonlar.
            </h1>
            <p className="mt-6 max-w-[36rem] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-relaxed text-[#c9d0c6]">
              Arsa, konut ya da proje: şablonu seçin, istediği bilgileri girin. Müzikli, yazılı, dikey video birkaç
              dakikada panelinizde.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="#sablonlar" className="site-btn-primary">
                Hemen oluşturun
              </Link>
              <Link href="#nasil-yapilir" className="site-btn border border-white/40 text-kagit hover:bg-white/10">
                Nasıl yapıldığını izleyin
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap justify-center gap-2 text-sm">
              {templateList.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/sablonlar/${t.id}`}
                    className="inline-block rounded-full border border-white/20 bg-gece/60 px-3.5 py-1.5 text-[#e3e8df] backdrop-blur hover:border-sari hover:text-sari"
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="#sablonlar" className="inline-block rounded-full px-3.5 py-1.5 text-[#a9b2a6] hover:text-kagit">
                  {SOON_TEMPLATES.length} şablon yakında
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Nasıl yapılır: panelin ekran kayıtları */}
      {tutorials.length > 0 && (
        <section id="nasil-yapilir" className="scroll-mt-6 px-3 pt-20 sm:px-4 md:pt-28">
          <div className="mx-auto max-w-[1240px] px-1 sm:px-2">
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
              <h2 className="max-w-2xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
                Videonuzu nasıl hazırlayacağınızı izleyin
              </h2>
              <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-soluk">
                Her şablonu panelde baştan sona kaydettik: hangi bilgiyi girdiğinizi ve sonunda çıkan videoyu görürsünüz.
                Aynısını kendi ilanınızla birkaç dakikada yaparsınız.
              </p>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-[1400px] rounded-[1.75rem] bg-gece px-4 py-8 text-kagit sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <HowTo tutorials={tutorials} />
          </div>
        </section>
      )}

      {/* Şablonlar: her biri doğrudan forma götürür */}
      <section id="sablonlar" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pt-20 pb-24 sm:px-6 md:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-2xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
              Şablonu seçin, hemen oluşturun
            </h2>
            <p className="mt-4 max-w-[36rem] text-[1.0625rem] leading-relaxed text-soluk">
              Kartın üzerine gelince örnek video oynar. "Hemen oluşturun" sizi doğrudan o şablonun formuna götürür;
              hesabınız yoksa önce kısa bir kayıt açılır.
            </p>
          </div>
          <Link href="/sablonlar" className="font-semibold text-zeytin underline-offset-4 hover:underline">
            Tüm şablonlar
          </Link>
        </div>
        <div className="mt-10">
          <TemplateGallery tone="light" cta howTo={tutorials.map((x) => x.template.id)} />
        </div>
      </section>

      {/* Eski yol */}
      <section className="bg-gece text-kagit">
        <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 md:py-28">
          <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
            İlanda fotoğraf yetmiyor. Çekim ekibi ise her ilana değmiyor.
          </h2>
          <div className="mt-14 grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#a9b2a6]">Çekim ekibiyle</h3>
              <ul className="mt-5 space-y-4 text-[1.0625rem] text-[#a9b2a6]">
                <li className="border-t border-white/10 pt-4">Çekim gününü ve drone iznini ayarlarsınız</li>
                <li className="border-t border-white/10 pt-4">Havanın uygun olmasını beklersiniz</li>
                <li className="border-t border-white/10 pt-4">Kurgu ve seslendirme ayrı bir iş olur</li>
                <li className="border-t border-white/10 pt-4">Bir ilan için günler geçer</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-sari">Arsa Video ile</h3>
              <ul className="mt-5 space-y-4 text-[1.0625rem]">
                <li className="border-t border-sari/40 pt-4">Şablonu seçip bilgileri girersiniz</li>
                <li className="border-t border-sari/40 pt-4">Kamera hareketi, yazılar ve müzik hazır gelir</li>
                <li className="border-t border-sari/40 pt-4">Ofis adınız ve telefonunuz videoda yer alır</li>
                <li className="border-t border-sari/40 pt-4">Video birkaç dakikada panelinizde olur</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SSS */}
      <section id="sss" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 py-20 sm:px-6 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em]">
            Sık sorulanlar
          </h2>
          <div className="border-t border-sinir">
            {sss.map((q) => (
              <details key={q.s} className="group border-b border-sinir">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-[1.1875rem] font-semibold [&::-webkit-details-marker]:hidden">
                  {q.s}
                  <span aria-hidden className="text-2xl leading-none text-zeytin transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-6 text-[1.0625rem] leading-relaxed text-soluk">{q.c}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Son çağrı */}
      <section className="border-t border-sinir">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <h2 className="max-w-2xl font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance">
            Satıştaki ilanınızın videosunu bugün hazırlayın.
          </h2>
          <Link href="/kayit" className="site-btn-primary shrink-0">
            Ücretsiz deneyin
          </Link>
        </div>
      </section>
    </>
  );
}
