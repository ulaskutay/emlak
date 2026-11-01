import type { Metadata } from "next";
import { CompanyDetails, LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "KVKK aydınlatma metni", alternates: { canonical: "/kvkk" } };

// TODO(yayın öncesi): hukuki inceleme; şirket bilgileri lib/site.ts içinde.
export default function Page() {
  const c = site.company;
  return (
    <LegalPage title="KVKK aydınlatma metni" updated="1 Kasım 2026" current="/kvkk">
      <p>
        Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) m. 10 ve Aydınlatma
        Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, Arsa Video hizmetini
        kullanmanız sırasında işlenen kişisel verileriniz hakkında sizi bilgilendirmek amacıyla veri sorumlusu
        sıfatıyla {c.title} tarafından hazırlanmıştır.
      </p>

      <h2>1. Veri sorumlusu</h2>
      <CompanyDetails />

      <h2>2. İşlenen kişisel veriler</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Veri kategorisi</th><th>Kapsam</th></tr>
          </thead>
          <tbody>
            <tr><td>Kimlik</td><td>Ad soyad ya da ofis/işletme adı</td></tr>
            <tr><td>İletişim</td><td>E-posta adresi; videoya eklemeyi seçtiğiniz telefon numarası ve ofis adı</td></tr>
            <tr><td>Müşteri işlem</td><td>Video siparişleri, seçilen şablonlar, kredi hareketleri, destek yazışmaları</td></tr>
            <tr><td>Finans</td><td>Ödeme tutarı, ödeme yöntemi, dekont ya da işlem referansı, fatura bilgileri (vergi dairesi ve numarası ya da T.C. kimlik numarası, fatura adresi). Kart bilgileriniz tarafımızca saklanmaz.</td></tr>
            <tr><td>İşlem güvenliği</td><td>Şifrenizin geri döndürülemez özeti, oturum kayıtları, IP adresi, tarayıcı ve cihaz bilgisi, erişim tarihi ve saati</td></tr>
            <tr><td>Kullanıcı içeriği</td><td>Parsel dosyası (il, ilçe, ada, parsel, konum, alan, nitelik), ilan fotoğrafları, fiyat ve imar bilgisi, ilan metni, seçilen çevre noktaları ve üretilen videolar</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Hizmet, özel nitelikli kişisel veri işlemeyi amaçlamaz. Yüklediğiniz fotoğraflarda tanınabilir kişiler ya da
        belge görüntüleri bulunmamasını rica ederiz; bulunması hâlinde bu verilerin hukuka uygun olarak elde
        edilmesinden ve yüklenmesinden siz sorumlusunuz.
      </p>

      <h2>3. İşleme amaçları ve hukuki sebepler</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Amaç</th><th>Hukuki sebep (KVKK m. 5/2)</th></tr>
          </thead>
          <tbody>
            <tr><td>Üyelik kaydının oluşturulması, hesabın yönetimi, video siparişinin alınması, üretilmesi ve teslimi</td><td>Sözleşmenin kurulması ve ifası (c)</td></tr>
            <tr><td>Kredi satışı, ödemelerin takibi, faturalandırma, cayma ve iade işlemleri</td><td>Sözleşmenin ifası (c); hukuki yükümlülük (ç)</td></tr>
            <tr><td>Muhasebe, vergi ve ticari defter kayıtlarının tutulması; yetkili kurumların taleplerinin karşılanması</td><td>Kanunlarda açıkça öngörülme (a); hukuki yükümlülük (ç)</td></tr>
            <tr><td>Hizmet ve hesap güvenliğinin sağlanması, kötüye kullanımın ve dolandırıcılığın önlenmesi, hata ayıklama</td><td>Meşru menfaat (f)</td></tr>
            <tr><td>Destek taleplerinin yanıtlanması, hizmetle ilgili zorunlu bilgilendirmeler</td><td>Sözleşmenin ifası (c); meşru menfaat (f)</td></tr>
            <tr><td>Hizmetin iyileştirilmesi için anonim ve toplu kullanım istatistiklerinin çıkarılması</td><td>Meşru menfaat (f)</td></tr>
            <tr><td>Uyuşmazlıklarda hakların korunması ve savunulması</td><td>Bir hakkın tesisi, kullanılması veya korunması (e)</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Size açık rızanız olmadan ticari elektronik ileti (kampanya, tanıtım e-postası) gönderilmez. Böyle bir
        gönderim yapılacaksa 6563 sayılı Kanun uyarınca ayrıca onayınız alınır.
      </p>

      <h2>4. Toplama yöntemi</h2>
      <p>
        Kişisel verileriniz; kayıt ve sipariş formları, panel üzerinden yüklediğiniz dosyalar, e-posta yazışmaları ve
        siteyi kullanırken oluşan sistem kayıtları aracılığıyla, kısmen ya da tamamen otomatik yollarla elektronik
        ortamda toplanır.
      </p>

      <h2>5. Kişisel verilerin aktarılması</h2>
      <p>
        Videonuzun üretilebilmesi için verilerinizin yalnızca gerekli kısmı, hizmeti birlikte sunduğumuz ve veri
        işleyen sıfatıyla hareket eden altyapı sağlayıcılarına aktarılır:
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Alıcı</th><th>Aktarılan veri ve amaç</th><th>Konum</th></tr>
          </thead>
          <tbody>
            <tr><td>Sunucu ve veritabanı barındırma hizmeti</td><td>Hesap, sipariş ve işlem kayıtlarının saklanması</td><td>Yurt içi / yurt dışı</td></tr>
            <tr><td>Cloudflare, Inc. (R2)</td><td>Yüklenen dosyaların ve üretilen videoların saklanması</td><td>Yurt dışı</td></tr>
            <tr><td>Google LLC (Maps Platform)</td><td>Parsel konumuna göre harita, uydu görüntüsü ve çevre bilgisi</td><td>Yurt dışı</td></tr>
            <tr><td>Higgsfield AI</td><td>Fotoğraflardan yapay zekâ ile görüntü ve video üretimi</td><td>Yurt dışı</td></tr>
            <tr><td>RunPod, Inc.</td><td>Drone çekimi ve görüntü işleme için grafik işlemci altyapısı</td><td>Yurt dışı</td></tr>
            <tr><td>ElevenLabs, Inc.</td><td>İlan metninin seslendirilmesi ve müzik üretimi</td><td>Yurt dışı</td></tr>
            <tr><td>Plausible Insights OÜ</td><td>Kişiyi tanımlamayan, çerezsiz site ziyaret istatistiği</td><td>Avrupa Birliği</td></tr>
            <tr><td>Muhasebe ve mali müşavirlik hizmeti, bankalar ve ödeme kuruluşları</td><td>Faturalandırma, ödeme ve iade işlemleri</td><td>Yurt içi</td></tr>
            <tr><td>Yetkili kamu kurum ve kuruluşları, yargı mercileri</td><td>Kanuni talep ve yükümlülükler</td><td>Yurt içi</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Yurt dışına aktarımlar KVKK m. 9 kapsamında; Kişisel Verileri Koruma Kurulu tarafından ilan edilen standart
        sözleşmeler gibi uygun güvencelerden birine dayanılarak, bunun mümkün olmadığı hâllerde ise sözleşmenin
        ifasıyla doğrudan ilgili olması şartıyla arızi aktarım olarak yapılır. Verileriniz reklam ya da pazarlama
        amacıyla üçüncü kişilere satılmaz veya kiralanmaz.
      </p>

      <h2>6. Saklama ve imha</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Veri</th><th>Saklama süresi</th></tr>
          </thead>
          <tbody>
            <tr><td>Hesap ve iletişim bilgileri</td><td>Hesap açık kaldığı sürece; kapanıştan sonra olası uyuşmazlıklar için genel zamanaşımı süresi (10 yıl) boyunca erişimi kısıtlı olarak</td></tr>
            <tr><td>Yüklenen dosyalar ve üretilen videolar</td><td>Siz silene ya da hesabınız kapanana kadar; kapanış talebinden itibaren en geç 30 gün içinde silinir</td></tr>
            <tr><td>Ödeme, fatura ve muhasebe kayıtları</td><td>6102 sayılı Türk Ticaret Kanunu ve 213 sayılı Vergi Usul Kanunu uyarınca 10 yıl</td></tr>
            <tr><td>Sistem, oturum ve erişim kayıtları</td><td>2 yıl</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Süresi dolan veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında
        Yönetmelik uyarınca silinir, yok edilir ya da anonim hâle getirilir. Altyapı sağlayıcılarına üretim için
        iletilen dosyalar, ilgili sağlayıcının saklama politikası çerçevesinde sınırlı süre tutulur.
      </p>

      <h2>7. KVKK m. 11 kapsamındaki haklarınız</h2>
      <p>Veri sorumlusuna başvurarak:</p>
      <ul>
        <li>kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
        <li>işlenmişse buna ilişkin bilgi talep etme,</li>
        <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>KVKK m. 7&apos;deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,</li>
        <li>düzeltme, silme ve yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
        <li>münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
        <li>kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
      </ul>
      <p>haklarına sahipsiniz.</p>

      <h2>8. Başvuru yöntemi</h2>
      <p>
        Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca; adınız
        soyadınız, imzanız (yazılı başvurularda), T.C. kimlik numaranız (yabancılar için uyruk ve pasaport numarası),
        tebligata esas adresiniz ya da e-posta adresiniz ve talep konunuzu içerecek şekilde:
      </p>
      <ul>
        <li>hesabınızda kayıtlı e-posta adresinizden <a href={`mailto:${site.email}`}>{site.email}</a> adresine,</li>
        {c.kep && <li>güvenli elektronik imzalı olarak {c.kep} KEP adresine,</li>}
        {c.address && <li>ıslak imzalı dilekçeyle {c.address} adresine</li>}
      </ul>
      <p>
        iletebilirsiniz. Başvurunuz, talebin niteliğine göre en geç 30 gün içinde ücretsiz olarak sonuçlandırılır;
        işlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulu&apos;nca belirlenen tarifedeki
        ücret alınabilir. Başvurunuzun reddedilmesi, cevabın yetersiz bulunması ya da süresinde cevap verilmemesi
        hâlinde KVKK m. 14 uyarınca Kişisel Verileri Koruma Kurulu&apos;na şikâyette bulunabilirsiniz.
      </p>
    </LegalPage>
  );
}
