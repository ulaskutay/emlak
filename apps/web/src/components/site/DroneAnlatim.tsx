import { AnlatimBolumu } from "@/components/site/AnlatimBolumu";
import { DroneCizim } from "@/components/site/DroneCizim";
import { createHref } from "@/lib/tutorials";

/** Ana sayfa: solda çizim drone, sağda arsa videosunun nasıl hazırlandığı. */
export function DroneAnlatim() {
  return (
    <AnlatimBolumu
      etiket="Arsa drone turu"
      baslik="Drone kiralamadan arsanız havadan tanıtılsın"
      text="Arsaya gitmenize gerek yok. Parseli uydu görüntüsünde bulup sınırlarını çiziyoruz; kamera üstünde drone gibi süzülürken arsanın yeri, alanı ve fiyatı anlatılıyor."
      adimlar={[
        { baslik: "Ada ve parseli yazın", text: "İl, ilçe, mahalle, ada ve parsel numarası yeterli; parsel TKGM kaydından bulunur." },
        { baslik: "Sınırlar haritaya çizilir", text: "Parselin köşeleri, kenar uzunlukları ve alanı uydu görüntüsüne işlenir." },
        { baslik: "Kamera drone gibi uçar", text: "Bölgeden parsele iner, etrafında tur atar; seslendirme, müzik ve fiyat eklenir." },
      ]}
      birincil={{ href: createHref("arsa-drone"), label: "Arsa videosu oluşturun" }}
      ikincil={{ href: "/sablonlar/arsa-drone", label: "Örneği izleyin" }}
      cizim={<DroneCizim className="w-full" />}
    />
  );
}
