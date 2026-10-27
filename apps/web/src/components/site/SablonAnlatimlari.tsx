import { AnlatimBolumu } from "@/components/site/AnlatimBolumu";
import { KonutCizim } from "@/components/site/KonutCizim";
import { ProjeCizim } from "@/components/site/ProjeCizim";
import { createHref } from "@/lib/tutorials";

/** Ana sayfa: Konut ve Proje şablonlarının drone bölümüyle aynı kalıpta, çizimli anlatımı. */
export function KonutAnlatim() {
  return (
    <AnlatimBolumu
      ters
      etiket={
        <>
          <span aria-hidden>🏡</span> Konut videoları
        </>
      }
      baslik="İlan fotoğrafları gezilen bir eve dönüşsün"
      text="Elinizdeki fotoğraflar yeter. Her kare sinematik bir kamera hareketine dönüşür, boş odalar istediğiniz tarzda döşenir, isterseniz bir sunucu evi odası odası anlatır."
      adimlar={[
        { baslik: "Fotoğrafları yükleyin", text: "3–8 ilan fotoğrafı; her birine kısa bir başlık yazabilirsiniz: salon, mutfak, balkon." },
        { baslik: "Boş odalar döşenir", text: "Yapay zekâ odayı seçtiğiniz tarzda döşer; alıcı evi yaşanmış haliyle görür." },
        { baslik: "Sunucu evi anlatır", text: "Seçtiğiniz emlakçı karakteri kamera karşısında ilanı Türkçe anlatır; fiyat ve telefon kartı sonda." },
      ]}
      birincil={{ href: createHref("ilan-videosu"), label: "Konut videosu oluşturun" }}
      ikincil={{ href: "/sablonlar/sunucu-ev", label: "Örneği izleyin" }}
      parilti="bg-gradient-to-br from-mercan/25 via-gunes/20 to-gok/15"
      cizim={<KonutCizim className="w-full" />}
    />
  );
}

export function ProjeAnlatim() {
  return (
    <AnlatimBolumu
      etiket={
        <>
          <span aria-hidden>🏗️</span> Proje videoları
        </>
      }
      baslik="Boş arsada yükselecek binayı bugünden gösterin"
      text="Daha temel atılmadan alıcı projeyi görsün. Parselin drone çekimi üstüne binanın bitmiş hali yerleştirilir; inşaat hızlandırılmış sahneyle kat kat yükselir."
      adimlar={[
        { baslik: "Parseli ve projeyi verin", text: "Ada/parsel numarası ve binanın görseli ya da kısa bir tarifi yeterli." },
        { baslik: "Bitmiş hali arsaya oturtulur", text: "Bina, drone çekimindeki gerçek arsanın üstüne doğru ölçekte yerleştirilir." },
        { baslik: "İnşaat sahnesi kurgulanır", text: "Boş arsadan bitmiş binaya hızlandırılmış geçiş; seslendirme, müzik ve iletişim kartıyla." },
      ]}
      birincil={{ href: createHref("bitmis-hali"), label: "Proje videosu oluşturun" }}
      ikincil={{ href: "/sablonlar/insaat-videosu", label: "Örneği izleyin" }}
      parilti="bg-gradient-to-br from-gunes/30 via-gok/15 to-cimen/15"
      cizim={<ProjeCizim className="w-full" />}
    />
  );
}
