import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ParselCizimi } from "@/components/site/ParselCizimi";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { templateList } from "@arsa/shared";
import { alanYazi, ornekParsel as p } from "@/lib/ornek-parsel";
import { site } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const sss = [
  {
    s: "Parsel dosyasını nereden alırım?",
    c: "parselsorgu.tkgm.gov.tr adresinde il, ilçe, mahalle, ada ve parseli seçin; sonuç ekranından KML ya da GeoJSON dosyasını indirin. Arsa Video'ya bu dosyayı yüklemeniz yeterli.",
  },
  {
    s: "Drone ya da çekim ekibi gerekiyor mu?",
    c: "Hayır. Video, Google'ın uydu ve 3D harita görüntüleri üzerinde parselinizin etrafında uçan sanal bir kamerayla hazırlanır. Arsaya gitmeniz gerekmez.",
  },
  {
    s: "Görüntüler güncel mi?",
    c: "Görüntüler Google'ın harita verisinden gelir; çekim tarihi bölgeye göre birkaç yıl öncesine ait olabilir. Parsel sınırı ise doğrudan TKGM dosyanızdan çizilir.",
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

      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pt-6 pb-20 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-12 md:pb-28">
        <div>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.95] font-bold tracking-[-0.035em] text-balance">
            Drone uçurmadan arsanızın drone videosu.
          </h1>
          <p className="mt-7 max-w-[34rem] text-[1.1875rem] leading-relaxed text-soluk">
            TKGM&apos;den indirdiğiniz parsel dosyasını yükleyin. Parsel sınırı, çevredeki deniz, okul ve köy merkezi,
            Türkçe seslendirme ve altyazıyla Reels&apos;e hazır video birkaç dakikada panelinizde.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/kayit" className="site-btn-primary">
              Ücretsiz deneyin
            </Link>
            <Link href="/sablonlar" className="site-btn-secondary">
              Şablonlara bakın
            </Link>
          </div>
          <dl className="mt-12 grid max-w-[34rem] grid-cols-3 gap-4 border-t border-sinir pt-5 text-sm">
            <div>
              <dt className="text-soluk">Örnek parsel</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {p.ada} ada {p.parsel} parsel
              </dd>
            </div>
            <div>
              <dt className="text-soluk">Konum</dt>
              <dd className="mt-1 font-semibold">
                {p.ilce}, {p.mahalle}
              </dd>
            </div>
            <div>
              <dt className="text-soluk">Alan</dt>
              <dd className="mt-1 font-semibold tabular-nums">{alanYazi(p.alanM2)}</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <ParselCizimi className="pointer-events-none absolute -top-[4%] -left-[6%] w-[96%]" />
          <ReelPlayer
            src="/media/ornek-reel.mp4"
            poster="/media/ornek-reel-poster.jpg"
            label="Örnek video: Ezine Dalyan'da satılık 11 dönüm zeytinlik"
            className="relative ml-auto w-[62%] max-w-[300px] min-w-[220px]"
          />
        </div>
      </section>

      {/* Şablonlar */}
      <section className="bg-gece text-kagit">
        <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-2xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
              Üç şablon, üç farklı ilan
            </h2>
            <Link href="/sablonlar" className="font-semibold text-sari underline-offset-4 hover:underline">
              Şablonların ayrıntıları
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {templateList.map((t) => (
              <TemplateCard key={t.id} t={t} href={`/sablonlar/${t.id}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section id="nasil-calisir" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 py-20 sm:px-6 md:py-28">
        <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em]">
          Arsa drone turu üç adımda
        </h2>

        <ol className="mt-14 space-y-20 md:space-y-28">
          <li className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-16">
            <div className="max-w-md">
              <span className="font-display text-5xl font-bold text-zeytin tabular-nums">1</span>
              <h3 className="mt-3 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
                Parsel dosyasını yükleyin
              </h3>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-soluk">
                TKGM Parsel Sorgu&apos;dan indirdiğiniz KML ya da GeoJSON dosyası yeterli. Ada, parsel, alan ve nitelik
                dosyadan okunur; fiyatı, imar durumunu ve ofis telefonunuzu siz eklersiniz.
              </p>
            </div>
            <dl className="self-start rounded-xl border border-sinir bg-kagit p-6 text-[0.9375rem] sm:p-8">
              <div className="flex items-baseline justify-between gap-4 border-b border-cizgi pb-4">
                <dt className="text-soluk">Dosya</dt>
                <dd className="font-semibold">ezine-230-ada-3.kml</dd>
              </div>
              {[
                ["İl / ilçe", `${p.il} / ${p.ilce}`],
                ["Mahalle", p.mahalle],
                ["Mevkii", p.mevkii],
                ["Ada / parsel", `${p.ada} / ${p.parsel}`],
                ["Alan", alanYazi(p.alanM2)],
                ["Nitelik", p.nitelik],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-cizgi py-3 last:border-0 last:pb-0">
                  <dt className="text-soluk">{k}</dt>
                  <dd className="text-right font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </li>

          <li className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-16">
            <div className="max-w-md">
              <span className="font-display text-5xl font-bold text-zeytin tabular-nums">2</span>
              <h3 className="mt-3 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
                Videoda görünecek yerleri seçin
              </h3>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-soluk">
                Parselin çevresindeki deniz, okul, hastane, köy ve ilçe merkezi uzaklıklarıyla listelenir. Alıcının
                soracağı dört yeri seçin; kamera parselden onlara uçar.
              </p>
            </div>
            <ul className="self-start rounded-xl border border-sinir bg-kagit p-6 sm:p-8">
              {p.cevre.map((c) => (
                <li key={c.ad} className="flex items-baseline justify-between gap-4 border-b border-cizgi py-4 first:pt-0 last:border-0 last:pb-0">
                  <span className="text-[1.0625rem]">{c.ad}</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{c.deger}</span>
                </li>
              ))}
            </ul>
          </li>

          <li className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-16">
            <div className="max-w-md">
              <span className="font-display text-5xl font-bold text-zeytin tabular-nums">3</span>
              <h3 className="mt-3 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
                Videoyu indirip paylaşın
              </h3>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-soluk">
                Türkçe seslendirme, altyazı ve müzikle dikey video hazırlanır. Ofis adınız ve telefonunuz her karede
                görünür; fiyat kapanışta yazılır.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["/media/kare-5.jpg", "Videodan kare: parselin köydeki konumu"],
                ["/media/kare-15.jpg", "Videodan kare: nitelik, ada/parsel ve uzaklıklar"],
                ["/media/kare-23.jpg", "Videodan kare: alan ve fiyat"],
              ].map(([src, alt]) => (
                <Image
                  key={src}
                  src={src!}
                  alt={alt!}
                  width={432}
                  height={768}
                  sizes="(min-width: 900px) 190px, 30vw"
                  className="aspect-[9/16] w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </li>
        </ol>
      </section>

      {/* Eski yol */}
      <section className="bg-gece text-kagit">
        <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 md:py-28">
          <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
            Arsa ilanında tek fotoğraf yetmiyor. Drone çekimi ise her ilana değmiyor.
          </h2>
          <div className="mt-14 grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#a9b2a6]">Drone çekimiyle</h3>
              <ul className="mt-5 space-y-4 text-[1.0625rem] text-[#a9b2a6]">
                <li className="border-t border-white/10 pt-4">Pilot ve uçuş iznini ayarlarsınız</li>
                <li className="border-t border-white/10 pt-4">Havanın uygun olmasını beklersiniz</li>
                <li className="border-t border-white/10 pt-4">Görüntüyü kurguya, seslendirmeye gönderirsiniz</li>
                <li className="border-t border-white/10 pt-4">Bir ilan için günler geçer</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-sari">Arsa Video ile</h3>
              <ul className="mt-5 space-y-4 text-[1.0625rem]">
                <li className="border-t border-sari/40 pt-4">Parsel dosyasını yüklersiniz</li>
                <li className="border-t border-sari/40 pt-4">Çevredeki önemli yerler uzaklıklarıyla bulunur</li>
                <li className="border-t border-sari/40 pt-4">Seslendirme, altyazı ve müzik hazır gelir</li>
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
            Satıştaki arsanızın videosunu bugün hazırlayın.
          </h2>
          <Link href="/kayit" className="site-btn-primary shrink-0">
            Ücretsiz deneyin
          </Link>
        </div>
      </section>
    </>
  );
}
