import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Kullanım koşulları", alternates: { canonical: "/kullanim-kosullari" } };

// TODO(yayın öncesi): hukuki inceleme; ücretli paketlerle birlikte mesafeli satış metinleri eklenecek.
export default function Page() {
  return (
    <LegalPage title="Kullanım koşulları" updated="18 Ekim 2026">
      <p>
        Bu koşullar, {site.company.title} tarafından sunulan Arsa Video hizmetinin kullanımını düzenler. Hesap açarak
        bu koşulları kabul etmiş olursunuz.
      </p>

      <h2>Hizmet</h2>
      <p>
        Arsa Video, yüklediğiniz parsel dosyası ve girdiğiniz ilan bilgileriyle harita görüntüleri üzerinde tanıtım
        videosu üretir. Hizmet şu anda deneme aşamasındadır; özellikler ve süreler değişebilir.
      </p>

      <h2>Sizin sorumluluklarınız</h2>
      <ul>
        <li>Yüklediğiniz parselin satışını ya da tanıtımını yapmaya yetkili olmalısınız.</li>
        <li>Videoya eklediğiniz fiyat, imar durumu ve iletişim bilgilerinin doğruluğundan siz sorumlusunuz.</li>
        <li>Videoları yanıltıcı ilan vermek ya da hukuka aykırı amaçlarla kullanamazsınız.</li>
      </ul>

      <h2>Görüntüler ve veriler hakkında</h2>
      <p>
        Videolardaki uydu ve 3D görüntüler Google&apos;a aittir ve çekim tarihleri güncel olmayabilir. Parsel sınırı
        yüklediğiniz dosyadan, çevre uzaklıkları harita verisinden hesaplanır ve yaklaşıktır. Videolar resmî ölçüm ya da
        tapu belgesi yerine geçmez; videodaki görüntü atıflarını kaldırmamalısınız.
      </p>

      <h2>Kullanım hakkı</h2>
      <p>
        Ürettiğiniz videoları kendi ilanlarınızda ve sosyal medya hesaplarınızda süresiz kullanabilirsiniz. Hizmetin
        yazılımı, şablonları ve markası {site.company.title}&apos;a aittir.
      </p>

      <h2>Hizmetin durdurulması</h2>
      <p>
        Bu koşullara aykırı kullanımda hesabınızı askıya alabiliriz. Hesabınızı istediğiniz zaman kapatabilirsiniz.
      </p>

      <h2>İletişim</h2>
      <p>
        Sorularınız için <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalPage>
  );
}
