import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Gizlilik politikası", alternates: { canonical: "/gizlilik" } };

export default function Page() {
  return (
    <LegalPage title="Gizlilik politikası" updated="1 Kasım 2026" current="/gizlilik">
      <p>
        {site.company.title} olarak Arsa Video&apos;yu kullanırken bize emanet ettiğiniz bilgileri korumayı
        önemsiyoruz. Bu politika hangi bilgileri neden topladığımızı, nasıl koruduğumuzu ve bunlar üzerinde hangi
        seçeneklere sahip olduğunuzu sade bir dille anlatır. Kişisel verilerin işlenme amaçları, hukuki sebepleri ve
        haklarınızın ayrıntısı <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde yer alır.
      </p>

      <h2>1. Temel ilkelerimiz</h2>
      <ul>
        <li>Videonuzu üretmek ve hesabınızı yönetmek için gerekenden fazla bilgi istemeyiz.</li>
        <li>Verilerinizi satmayız, kiralamayız ve reklam amacıyla kullanmayız.</li>
        <li>Siteyi takip ya da reklam çerezi kullanmadan ölçeriz.</li>
        <li>Videolarınızı izniniz olmadan örnek olarak yayınlamayız.</li>
      </ul>

      <h2>2. Topladığımız bilgiler</h2>
      <h3>Sizin verdiğiniz bilgiler</h3>
      <p>
        Kayıt olurken ofis adınız ya da adınız soyadınız, e-posta adresiniz ve şifreniz; sipariş verirken parsel
        dosyanız, ilan fotoğraflarınız, ilan metniniz, fiyat, imar ve iletişim bilgileriniz; kredi satın alırken
        ödeme ve fatura bilgileriniz.
      </p>
      <h3>Hizmeti kullanırken oluşan bilgiler</h3>
      <p>
        Oturum ve erişim kayıtları (IP adresi, tarayıcı ve cihaz bilgisi, tarih ve saat), sipariş ve kredi
        hareketleri, video üretim durumları ve hata kayıtları.
      </p>

      <h2>3. Bilgileri nasıl kullanırız</h2>
      <ul>
        <li>Hesabınızı açmak, oturumunuzu yönetmek ve sipariş ettiğiniz videoyu üretip size teslim etmek,</li>
        <li>kredi satışını, faturalandırmayı ve iadeleri yürütmek,</li>
        <li>destek taleplerinizi yanıtlamak ve hizmetle ilgili zorunlu bildirimleri iletmek,</li>
        <li>hizmeti kötüye kullanıma karşı korumak, hataları bulup gidermek,</li>
        <li>yasal yükümlülüklerimizi yerine getirmek.</li>
      </ul>

      <h2>4. Yüklediğiniz dosyalar ve videolar</h2>
      <p>
        Parsel dosyalarınız, fotoğraflarınız ve ürettiğiniz videolar yalnızca sizin hesabınızda görünür. Panelden
        açılan video bağlantıları kısa süreli olarak imzalanır; bağlantının süresi dolduğunda video yeniden
        panelden açılmalıdır. İndirdiğiniz videoları paylaştığınız kişilerin kullanımı sizin kontrolünüzdedir.
      </p>
      <p>
        Videonun üretimi için dosyalarınızın gerekli kısmı yapay zekâ, harita, seslendirme ve görüntü işleme
        altyapısı sağlayan hizmet sağlayıcılarımıza iletilir. Bu sağlayıcılar verilerinizi yalnızca bizim adımıza ve
        talimatlarımız doğrultusunda işler. Sağlayıcıların listesi <Link href="/kvkk">KVKK Aydınlatma Metni</Link>
        &apos;nde yer alır.
      </p>

      <h2>5. Güvenlik önlemleri</h2>
      <ul>
        <li>Siteyle tüm bağlantılar HTTPS (TLS) ile şifrelenir.</li>
        <li>Şifreler geri döndürülemez özet (hash) olarak saklanır; şifrenizi biz de göremeyiz.</li>
        <li>Dosyalar erişimi kısıtlı depolama alanında tutulur ve yalnızca süreli imzalı bağlantılarla açılır.</li>
        <li>Yönetim paneline erişim yetkili personelle sınırlıdır ve yetkiler görev gereğine göre verilir.</li>
        <li>Altyapı sağlayıcılarımızı güvenlik ve veri koruma uygulamalarına göre seçeriz.</li>
      </ul>
      <p>
        Hiçbir sistem tam güvenlik garantisi veremez. Verilerinizi etkileyen bir güvenlik ihlali öğrenirsek
        KVKK m. 12 uyarınca ilgili kişilere ve Kişisel Verileri Koruma Kurulu&apos;na en kısa sürede bildirimde
        bulunuruz.
      </p>

      <h2>6. Ziyaret ölçümü ve çerezler</h2>
      <p>
        Sitenin hangi sayfalarının ne kadar ziyaret edildiğini, çerez kullanmayan ve kişiyi tanımlamayan bir ölçüm
        aracıyla sayarız. Kullandığımız tek çerez, panelde oturumunuzun açık kalmasını sağlayan zorunlu oturum
        çerezidir. Ayrıntılar <Link href="/cerez">Çerez Politikası</Link>&apos;nda.
      </p>

      <h2>7. Saklama süresi</h2>
      <p>
        Hesap bilgileriniz hesabınız açık kaldığı sürece, dosya ve videolarınız siz silene ya da hesabınız kapanana
        kadar saklanır. Ödeme ve fatura kayıtları ile güvenlik kayıtları yasal süreler boyunca tutulur. Süreler{" "}
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde tablo hâlinde yer alır.
      </p>

      <h2>8. Seçenekleriniz ve haklarınız</h2>
      <ul>
        <li>Hesap bilgilerinizin düzeltilmesini isteyebilirsiniz.</li>
        <li>Verilerinizin bir kopyasını ve hangi sağlayıcılara aktarıldığını öğrenebilirsiniz.</li>
        <li>Hesabınızın ve tüm videolarınızın silinmesini isteyebilirsiniz; yasal saklama yükümlülüğü olan kayıtlar hariç verileriniz en geç 30 gün içinde silinir.</li>
      </ul>
      <p>
        Taleplerinizi <a href={`mailto:${site.email}`}>{site.email}</a> adresine, hesabınızda kayıtlı e-posta
        adresinden iletebilirsiniz.
      </p>

      <h2>9. Çocukların gizliliği</h2>
      <p>
        Hizmet, emlak profesyonellerine ve taşınmaz sahiplerine yöneliktir; 18 yaşından küçüklerin hesap açması
        amaçlanmamıştır ve bu kişilerden bilerek veri toplamayız.
      </p>

      <h2>10. Değişiklikler</h2>
      <p>
        Bu politikayı hizmetteki ya da mevzuattaki değişikliklere göre güncelleyebiliriz. Güncel metin her zaman bu
        sayfada yayınlanır; esaslı değişiklikleri e-posta ya da panel bildirimiyle duyururuz.
      </p>
    </LegalPage>
  );
}
