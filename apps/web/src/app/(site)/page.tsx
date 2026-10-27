import type { Metadata } from "next";
import Link from "next/link";
import { templateList } from "@arsa/shared";
import { FilmSeridi } from "@/components/site/FilmSeridi";
import { HeroVizor } from "@/components/site/HeroVizor";
import { OnceSonra } from "@/components/site/OnceSonra";
import { SonCagri } from "@/components/site/SonCagri";
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

type Adim = { baslik: string; text: string };

const ARSA: Adim[] = [
  { baslik: "Ada ve parseli yazın", text: "İl, ilçe, mahalle, ada ve parsel numarası yeterli; parsel TKGM kaydından bulunur." },
  { baslik: "Sınırlar haritaya çizilir", text: "Parselin köşeleri, kenar uzunlukları ve alanı uydu görüntüsüne işlenir." },
  { baslik: "Kamera drone gibi uçar", text: "Bölgeden parsele iner, etrafında tur atar; seslendirme, müzik ve fiyat eklenir." },
];
const KONUT: Adim[] = [
  { baslik: "Fotoğrafları yükleyin", text: "3–8 ilan fotoğrafı; her birine kısa bir başlık yazabilirsiniz: salon, mutfak, balkon." },
  { baslik: "Boş odaya sanal eşya döşenir", text: "Yapay zekâ odaya seçtiğiniz tarzda mobilya yerleştirir; alıcı evi yaşanmış haliyle görür." },
  { baslik: "Sunucu evi anlatır", text: "Seçtiğiniz emlakçı karakteri kamera karşısında ilanı Türkçe anlatır; fiyat ve telefon kartı sonda." },
];
const PROJE: Adim[] = [
  { baslik: "Parseli ve projeyi verin", text: "Ada/parsel numarası ve binanın görseli ya da kısa bir tarifi yeterli." },
  { baslik: "Bitmiş hali arsaya oturtulur", text: "Bina, drone çekimindeki gerçek arsanın üstüne doğru ölçekte yerleştirilir." },
  { baslik: "İnşaat sahnesi kurgulanır", text: "Boş arsadan bitmiş binaya hızlandırılmış geçiş; seslendirme, müzik ve iletişim kartıyla." },
];

const KARSILASTIRMA = [
  { konu: "Hazırlık", ekip: "Çekim günü ve drone izni ayarlanır", biz: "Şablonu seçip bilgileri girersiniz" },
  { konu: "Hava", ekip: "Uçuş için uygun hava beklenir", biz: "Uydu görüntüsü ve fotoğraflarla çalışır, hava beklenmez" },
  { konu: "Kurgu ve ses", ekip: "Ayrı bir iş olarak yaptırılır", biz: "Kamera hareketi, yazılar, seslendirme ve müzik hazır gelir" },
  { konu: "Teslim", ekip: "Bir ilan için günler geçer", biz: "Video birkaç dakikada panelinizde olur" },
];

const UC_ADIM: Adim[] = [
  { baslik: "Şablonu seçin", text: "Arsa, konut ya da proje: ilanınıza uyan video türünü seçin, örneğini önceden izleyin." },
  { baslik: "Bilgileri girin", text: "Parsel dosyası ya da fotoğraflar, fiyat ve telefon. Formu şablonun kendisi adım adım sorar." },
  { baslik: "Videoyu paylaşın", text: "Birkaç dakikada panelinizde. Reels, TikTok, Shorts ve ilan sitelerine hazır dikey video." },
];

/** Künye gibi dizilmiş adımlar: solda rakam, ince çizgilerle ayrılmış satırlar. */
function Adimlar({ adimlar }: { adimlar: Adim[] }) {
  return (
    <ol className="border-b border-white/15">
      {adimlar.map((a, i) => (
        <li key={a.baslik} className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-white/15 py-4">
          <span className="text-xl font-extrabold text-gunes tabular-nums">{i + 1}</span>
          <div>
            <div className="font-bold">{a.baslik}</div>
            <p className="mt-0.5 text-[#b9c3d9]">{a.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Bir şablon türünün anlatımı: büyük başlık, adımlar ve iki çağrı; yanında gerçek çıktı. */
function Anlatim({
  ust,
  baslik,
  text,
  adimlar,
  olustur,
  ornek,
  gorsel,
  ters,
}: {
  ust: string;
  baslik: string;
  text: string;
  adimlar: Adim[];
  olustur: string;
  ornek: string;
  gorsel: React.ReactNode;
  ters?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-6 sm:px-10 lg:grid-cols-2 lg:gap-20">
      <div className={ters ? "lg:order-2" : ""}>{gorsel}</div>
      <div>
        <p className="text-[0.9375rem] font-semibold text-gunes">{ust}</p>
        <h2 className="mt-3 text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance">{baslik}</h2>
        <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-[#b9c3d9]">{text}</p>
        <div className="mt-8 max-w-xl">
          <Adimlar adimlar={adimlar} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={olustur} className="site-btn h-13 bg-gunes px-7 text-base text-lacivert hover:bg-[#ffbf1a]">
            Videoyu oluşturun
          </Link>
          <Link href={ornek} className="site-btn h-13 border border-white/30 px-6 text-base text-white hover:bg-white/10">
            Örneği izleyin
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-lacivert text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <HeroVizor />

      {/* Film şeridi: gerçek çıktılar */}
      <section className="py-20 md:py-28">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-6 px-6 sm:px-10">
          <h2 className="max-w-3xl text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance">
            {templateList.length} şablon. Hepsi gerçek çıktı, hepsi dikey.
          </h2>
          <p className="max-w-sm text-[1.0625rem] leading-relaxed text-[#b9c3d9]">
            Kaydırın; görünen video sessiz oynar. Reels, TikTok, Shorts ve ilan sitelerine aynı dosya gider.
          </p>
        </div>
        <div className="mt-12">
          <FilmSeridi />
        </div>
      </section>

      {/* Arsa */}
      <section className="py-20 md:py-28">
        <Anlatim
          ust="Arsa drone turu"
          baslik="Arsaya gitmeden, drone kiralamadan."
          text="Parseli uydu görüntüsünde bulup sınırlarını çiziyoruz; kamera üstünde drone gibi süzülürken arsanın yeri, alanı ve fiyatı anlatılıyor."
          adimlar={ARSA}
          olustur={createHref("arsa-drone")}
          ornek="/sablonlar/arsa-drone"
          gorsel={
            <div className="relative mx-auto max-w-[440px] overflow-hidden rounded-2xl bg-black">
              {/* 1080p drone render'ından kartsız kare; sayılar altta künyede */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/arsa-parsel.webp" alt="Parsel sınırı uydu görüntüsünde" className="block aspect-[4/5] w-full object-cover object-center" />
              <dl className="absolute right-3 bottom-3 left-3 grid grid-cols-3 gap-2 rounded-xl bg-lacivert/80 p-3 text-xs backdrop-blur sm:text-sm">
                {[
                  ["Ada / parsel", "230 / 3"],
                  ["Alan", "11.091 m²"],
                  ["Kenar", "168 m"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-white/55">{k}</dt>
                    <dd className="font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          }
        />
      </section>

      {/* Konut */}
      <section className="bg-[#070e22] py-20 md:py-28">
        <Anlatim
          ters
          ust="Konut videoları"
          baslik="Boş daire fotoğrafı, yaşanmış bir eve dönüşsün."
          text="Elinizdeki fotoğraflar yeter. Her kare sinematik bir kamera hareketine dönüşür, boş odalara seçtiğiniz tarzda sanal eşya döşenir, isterseniz bir sunucu evi oda oda anlatır."
          adimlar={KONUT}
          olustur={createHref("ilan-videosu")}
          ornek="/sablonlar/sunucu-ev"
          gorsel={<OnceSonra once="/media/oda-cocuk-bos.webp" sonra="/media/oda-cocuk-doseli.webp" className="mx-auto max-w-[400px]" />}
        />
      </section>

      {/* Proje */}
      <section className="py-20 md:py-28">
        <Anlatim
          ust="Proje videoları"
          baslik="Temel atılmadan, bitmiş binayı arsada gösterin."
          text="Parselin drone çekimi üstüne binanın bitmiş hali yerleştirilir; inşaat hızlandırılmış sahneyle kat kat yükselir."
          adimlar={PROJE}
          olustur={createHref("bitmis-hali")}
          ornek="/sablonlar/insaat-videosu"
          gorsel={
            <ol className="mx-auto grid max-w-[560px] grid-cols-4 gap-2" aria-label="İnşaat aşamaları">
              {["Boş arsa", "Temel", "Kaba yapı", "Bitmiş"].map((ad, i) => (
                <li key={ad}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/media/insaat-${i + 1}.webp`} alt={ad} loading="lazy" className="block aspect-[640/764] w-full rounded-xl object-cover" />
                  <span className="mt-2 block text-xs font-semibold text-white/70 sm:text-sm">{ad}</span>
                </li>
              ))}
            </ol>
          }
        />
      </section>

      {/* Karşılaştırma */}
      <section className="bg-[#070e22] py-20 md:py-28">
        <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
          <h2 className="max-w-3xl text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance">
            Aynı ilan, iki yol.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <h3 className="text-xl font-bold text-white/60">Çekim ekibiyle</h3>
              <dl className="mt-5 border-b border-white/15">
                {KARSILASTIRMA.map((k) => (
                  <div key={k.konu} className="border-t border-white/15 py-4">
                    <dt className="text-sm text-white/45">{k.konu}</dt>
                    <dd className="mt-0.5 text-[1.0625rem] text-white/60">{k.ekip}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gunes">Arsa Video ile</h3>
              <dl className="mt-5 border-b border-gunes/40">
                {KARSILASTIRMA.map((k) => (
                  <div key={k.konu} className="border-t border-gunes/40 py-4">
                    <dt className="text-sm text-white/55">{k.konu}</dt>
                    <dd className="mt-0.5 text-[1.0625rem] font-semibold">{k.biz}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Üç adım */}
      <section className="py-20 md:py-28">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 sm:px-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div>
            <h2 className="text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance">Üç adımda hazır.</h2>
            <p className="mt-4 max-w-sm text-[1.0625rem] leading-relaxed text-[#b9c3d9]">Hangi şablonu seçerseniz seçin, video aynı sırayla hazırlanır.</p>
            <Link href="/nasil-yapilir" className="mt-6 inline-block font-bold text-gunes underline-offset-4 hover:underline">
              Panelde nasıl hazırlandığını izleyin
            </Link>
          </div>
          <ol className="grid gap-x-8 sm:grid-cols-3">
            {UC_ADIM.map((a, i) => (
              <li key={a.baslik} className="border-t border-white/15 pt-5 pb-8 sm:pb-0">
                <span className="block text-[4rem] leading-none font-extrabold text-gunes tabular-nums">{i + 1}</span>
                <h3 className="mt-5 text-xl font-bold">{a.baslik}</h3>
                <p className="mt-2 leading-relaxed text-[#b9c3d9]">{a.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SonCagri />
    </div>
  );
}
