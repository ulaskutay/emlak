import Link from "next/link";
import { createHref } from "@/lib/tutorials";

const ADIMLAR = [
  { baslik: "Ada ve parseli yazın", text: "İl, ilçe, mahalle, ada ve parsel numarası yeterli; parsel TKGM kaydından bulunur." },
  { baslik: "Sınırlar haritaya çizilir", text: "Parselin köşeleri, kenar uzunlukları ve alanı uydu görüntüsüne işlenir." },
  { baslik: "Kamera drone gibi uçar", text: "Bölgeden parsele iner, etrafında tur atar; seslendirme, müzik ve fiyat eklenir." },
];

/** Ana sayfa: solda parselin üstünde uçan drone sahnesi, sağda arsa videosunun nasıl hazırlandığı. */
export function DroneAnlatim() {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div aria-hidden className="relative mx-auto w-full max-w-[460px]">
          <div className="absolute -inset-3 rounded-[3rem] sm:-inset-6 bg-gradient-to-br from-gok/20 via-gunes/25 to-cimen/20 blur-2xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-lacivert shadow-[0_40px_80px_-30px_rgba(13,27,62,.6)]">
            <img src="/media/drone-sahne.jpg" alt="" className="uydu-kay absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-lacivert/35 via-transparent to-lacivert/45" />

            <div className="drone-tur absolute top-[14%] left-1/2 -ml-[22%] w-[44%]">
              <div className="absolute top-[150%] left-1/2 h-[14%] w-[60%] -translate-x-1/2 rounded-full bg-black/40 blur-md" />
              <img src="/media/drone.webp" alt="" className="suzul relative w-full drop-shadow-[0_14px_14px_rgba(0,0,0,.45)]" />
            </div>

            <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[11px] font-bold text-white sm:text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-mercan" />
                Kayıt
              </span>
              <span className="rounded-full bg-black/45 px-2.5 py-1 backdrop-blur">Yükseklik 120 m</span>
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 text-lacivert">
              <div>
                <div className="text-[11px] font-semibold text-gri">Ezine, Çanakkale · Dalyan</div>
                <div className="font-extrabold">230 ada 3 parsel</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold text-gri">Alan</div>
                <div className="font-extrabold">11.091 m²</div>
              </div>
            </div>
          </div>
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
