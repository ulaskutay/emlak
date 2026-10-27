import Link from "next/link";
import { DroneCizim } from "@/components/site/DroneCizim";
import { createHref } from "@/lib/tutorials";

const ADIMLAR = [
  { baslik: "Ada ve parseli yazın", text: "İl, ilçe, mahalle, ada ve parsel numarası yeterli; parsel TKGM kaydından bulunur." },
  { baslik: "Sınırlar haritaya çizilir", text: "Parselin köşeleri, kenar uzunlukları ve alanı uydu görüntüsüne işlenir." },
  { baslik: "Kamera drone gibi uçar", text: "Bölgeden parsele iner, etrafında tur atar; seslendirme, müzik ve fiyat eklenir." },
];

/** Ana sayfa: solda çizim drone, sağda arsa videosunun nasıl hazırlandığı. */
export function DroneAnlatim() {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div aria-hidden className="relative mx-auto w-full max-w-[540px]">
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-gok/20 via-gunes/25 to-cimen/15 blur-3xl" />
          <DroneCizim className="relative w-full drop-shadow-[0_30px_40px_-20px_rgba(13,27,62,.45)]" />
        </div>

        <div className="text-center lg:text-left">
          <span className="site-etiket">
            <span aria-hidden>🚁</span> Arsa drone turu
          </span>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">
            Drone kiralamadan arsanız havadan tanıtılsın
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-gri lg:mx-0">
            Arsaya gitmenize gerek yok. Parseli uydu görüntüsünde bulup sınırlarını çiziyoruz; kamera üstünde drone gibi
            süzülürken arsanın yeri, alanı ve fiyatı anlatılıyor.
          </p>
          <ol className="mx-auto mt-8 max-w-xl space-y-5 text-left lg:mx-0">
            {ADIMLAR.map((a, i) => (
              <li key={a.baslik} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gok-acik font-extrabold text-gok">{i + 1}</span>
                <div>
                  <div className="font-bold">{a.baslik}</div>
                  <p className="mt-0.5 text-gri">{a.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href={createHref("arsa-drone")} className="site-btn-primary h-13 px-7">
              Arsa videosu oluşturun
            </Link>
            <Link href="/sablonlar/arsa-drone" className="site-btn-secondary h-13 px-6">
              Örneği izleyin
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
