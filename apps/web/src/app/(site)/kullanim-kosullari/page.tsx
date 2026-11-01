import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Kullanım koşulları", alternates: { canonical: "/kullanim-kosullari" } };

// TODO(yayın öncesi): hukuki inceleme.
export default function Page() {
  const c = site.company;
  return (
    <LegalPage title="Kullanım koşulları" updated="1 Kasım 2026" current="/kullanim-kosullari">
      <p>
        Bu Kullanım Koşulları (&quot;Koşullar&quot;), {c.title} (&quot;Şirket&quot;, &quot;biz&quot;) tarafından{" "}
        {site.url.replace(/^https?:\/\//, "")} adresinde sunulan Arsa Video hizmetinin kullanımına ilişkin şartları
        düzenler. Hesap oluşturarak ya da hizmeti kullanarak bu Koşulları okuduğunuzu, anladığınızı ve kabul ettiğinizi
        beyan edersiniz. Koşulları kabul etmiyorsanız hizmeti kullanmayınız.
      </p>

      <h2>1. Tanımlar</h2>
      <ul>
        <li><strong>Hizmet:</strong> Arsa Video internet sitesi, kullanıcı paneli ve bunlar üzerinden sunulan video üretim hizmetinin tamamı.</li>
        <li><strong>Kullanıcı:</strong> Hizmete üye olan gerçek ya da tüzel kişi.</li>
        <li><strong>Şablon:</strong> Videonun kurgusunu, sahnelerini ve üretim yöntemini belirleyen hazır video kalıbı.</li>
        <li><strong>Kredi:</strong> Video siparişlerinde kullanılan, satın alınarak hesaba tanımlanan dijital kullanım birimi.</li>
        <li><strong>Kullanıcı İçeriği:</strong> Kullanıcının yüklediği parsel dosyası, fotoğraf, metin, fiyat, imar ve iletişim bilgisi gibi her türlü veri.</li>
        <li><strong>Çıktı:</strong> Hizmet aracılığıyla Kullanıcı İçeriğinden üretilen video, görsel ve ses dosyaları.</li>
      </ul>

      <h2>2. Üyelik ve hesap güvenliği</h2>
      <ol>
        <li>Hizmeti kullanmak için 18 yaşını doldurmuş ve fiil ehliyetine sahip olmanız ya da bir tüzel kişiyi temsile yetkili bulunmanız gerekir.</li>
        <li>Kayıt sırasında verdiğiniz bilgilerin doğru ve güncel olmasından siz sorumlusunuz.</li>
        <li>Şifrenizin gizliliğini korumak ve hesabınız üzerinden yapılan işlemler sizin sorumluluğunuzdadır. Hesabınızın yetkisiz kullanıldığını fark ederseniz derhal <a href={`mailto:${site.email}`}>{site.email}</a> adresine bildiriniz.</li>
        <li>Hesabınızı üçüncü kişilere devredemez, satamaz ya da kiralayamazsınız. Bir ofis içinde birden fazla kişinin aynı hesabı kullanması, hesap sahibinin sorumluluğundadır.</li>
      </ol>

      <h2>3. Hizmetin kapsamı</h2>
      <p>
        Hizmet; parsel dosyasından drone turu, ilan fotoğraflarından tanıtım videosu, boş arsadan bitmiş hâl ve inşaat
        videosu, boş evin sanal döşenmesi ve yapay zekâ sunuculu ev turu gibi şablonlar üzerinden tanıtım videosu
        üretimini kapsar. Güncel şablonlar ve her birinin kredi karşılığı{" "}
        <Link href="/sablonlar">şablonlar sayfasında</Link> ve sipariş ekranında gösterilir.
      </p>
      <ol>
        <li>Hizmet geliştirilmeye devam etmektedir. Şablonları, üretim yöntemlerini, video sürelerini ve teslim sürelerini, verilmiş siparişleri olumsuz etkilemeyecek şekilde değiştirebiliriz.</li>
        <li>Sipariş ekranında gösterilen üretim süreleri tahminidir; sunucu yoğunluğu ve üçüncü taraf altyapı sağlayıcılarının durumu süreyi uzatabilir.</li>
        <li>Hizmetin kesintisiz ya da hatasız olacağını taahhüt etmeyiz; planlı bakım ve beklenmedik arızalarda hizmete erişim geçici olarak durabilir.</li>
      </ol>

      <h2>4. Krediler ve ödeme</h2>
      <p>
        Video siparişleri kredi ile verilir; sipariş onaylandığında şablonun kredi karşılığı bakiyenizden düşülür.
        Kredi satın alımına, ödemeye, cayma hakkına ve iadeye ilişkin hükümler{" "}
        <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu</Link>&apos;nda yer alır.
        Teknik bir sorun nedeniyle üretilemeyen ya da şablonun temel niteliklerini taşımayan videoların kredisi iade
        edilir.
      </p>

      <h2>5. Kullanıcının yükümlülükleri</h2>
      <p>Hizmeti kullanırken aşağıdaki kurallara uymayı kabul edersiniz:</p>
      <ol>
        <li>Yalnızca satışını, kiralamasını ya da tanıtımını yapmaya yetkili olduğunuz taşınmazlar için video üretirsiniz. İlan ve aracılık faaliyetinizde Taşınmaz Ticareti Hakkında Yönetmelik dahil ilgili mevzuata uymak sizin sorumluluğunuzdadır.</li>
        <li>Yüklediğiniz fotoğraf ve dosyaları kullanma hakkına sahip olursunuz; başkasına ait fotoğrafları izinsiz yüklemezsiniz.</li>
        <li>Videoya eklediğiniz fiyat, alan, imar durumu, iletişim ve diğer ilan bilgilerinin doğruluğundan siz sorumlusunuz.</li>
        <li>Fotoğraflarda tanınabilir kişiler, plakalar, kimlik ya da belge görüntüleri gibi kişisel veriler bulunuyorsa bunları yüklemeden önce kaldırır ya da ilgili kişilerin rızasını alırsınız.</li>
        <li>Çıktıları yanıltıcı reklam, haksız ticari uygulama, dolandırıcılık, kişilik haklarına saldırı ya da hukuka aykırı başka bir amaçla kullanmazsınız.</li>
        <li>Hizmetin yazılımını kopyalamaz, tersine mühendislik yapmaz, güvenlik önlemlerini aşmaya çalışmaz, otomatik araçlarla (bot, kazıyıcı) aşırı yük oluşturmaz ve hizmeti başka bir ürünün parçası olarak yeniden satmazsınız.</li>
      </ol>

      <h2>6. Yapay zekâ ile üretilen içerik</h2>
      <ol>
        <li>Bazı şablonlar (bitmiş hâl, inşaat videosu, boş evi döşe, sunuculu ev turu) görüntülerin önemli bir kısmını yapay zekâ ile üretir. Bu görüntüler temsilîdir; taşınmazın gerçek durumunu, yapılacak yapının projesini, mobilya ya da dekorasyonu göstermez.</li>
        <li>Yapay zekâ ile döşenmiş, tamamlanmış ya da dönüştürülmüş görüntüleri ilanlarda kullanırken bunun temsilî olduğunu (örneğin &quot;Görseller temsilîdir&quot; ibaresiyle) açıkça belirtmekle yükümlüsünüz. Videolara eklenen bu yöndeki ibareleri kaldıramazsınız.</li>
        <li>Sunuculu ev turundaki emlak danışmanı karakterleri yapay zekâ ile oluşturulmuş kurgusal kişilerdir; gerçek bir kişiyi temsil etmez. Bu karakterleri gerçek bir çalışanınızmış gibi tanıtamaz ve videodan ayırarak başka amaçla kullanamazsınız.</li>
        <li>Yapay zekâ çıktıları beklenmedik hatalar (yanlış oda düzeni, bozuk nesne, hatalı telaffuz gibi) içerebilir. Çıktıyı yayınlamadan önce kontrol etmek sizin sorumluluğunuzdadır.</li>
      </ol>

      <h2>7. Harita ve üçüncü taraf verileri</h2>
      <p>
        Drone turlarındaki uydu ve üç boyutlu görüntüler Google&apos;a aittir ve çekim tarihleri güncel olmayabilir.
        Parsel sınırı yüklediğiniz dosyadan, çevredeki noktalara uzaklıklar harita verisinden hesaplanır ve
        yaklaşıktır. Çıktılar resmî ölçüm, aplikasyon, imar durum belgesi ya da tapu kaydı yerine geçmez. Videolardaki
        harita ve görüntü atıflarını kaldırmamalı, değiştirmemelisiniz.
      </p>

      <h2>8. Fikri mülkiyet ve kullanım hakkı</h2>
      <ol>
        <li>Kullanıcı İçeriği üzerindeki haklarınız size aittir. Videonuzu üretebilmemiz için bize, Kullanıcı İçeriğini yalnızca hizmeti sunmak amacıyla işleme, çoğaltma ve altyapı sağlayıcılarımıza iletme hakkını, hizmet süresiyle sınırlı ve ücretsiz olarak tanırsınız.</li>
        <li>Çıktıları; kendi ilanlarınızda, internet sitenizde, sosyal medya hesaplarınızda ve emlak portallarında süre ve yer sınırı olmaksızın ticari amaçla kullanabilirsiniz.</li>
        <li>Hizmetin yazılımı, şablonları, kurgu yapısı, arayüzü, Arsa Video markası ve logosu ile videolarda kullanılan müzik, ses efekti, yazı tipi ve sunucu karakterleri Şirket&apos;e ya da lisans verenlerine aittir. Bu unsurları videodan ayrı olarak kullanamaz, dağıtamaz ya da satamazsınız.</li>
        <li>Videolarınızı sitemizde ya da tanıtım çalışmalarımızda örnek olarak yalnızca önceden yazılı izninizi alarak gösteririz.</li>
      </ol>

      <h2>9. Sorumluluğun sınırlandırılması</h2>
      <ol>
        <li>Hizmet &quot;olduğu gibi&quot; sunulur. Çıktıların belirli bir satış ya da kiralama sonucu doğuracağını taahhüt etmeyiz.</li>
        <li>Kullanıcı İçeriğinin hukuka aykırılığından, ilan bilgilerinin yanlışlığından ve Çıktıların Koşullara aykırı kullanımından doğan zararlardan sorumlu değiliz.</li>
        <li>Kast ve ağır kusur hâlleri ile kanunen sınırlandırılamayan sorumluluklar saklı kalmak üzere; dolaylı zararlardan, kâr ve müşteri kaybından sorumlu değiliz ve toplam sorumluluğumuz, zarara yol açan olaydan önceki on iki ayda hizmet için ödediğiniz toplam bedelle sınırlıdır.</li>
        <li>Bu madde, tüketici sıfatıyla hizmet alan Kullanıcıların 6502 sayılı Tüketicinin Korunması Hakkında Kanun&apos;dan doğan haklarını sınırlamaz.</li>
      </ol>

      <h2>10. Kullanıcının tazmin yükümlülüğü</h2>
      <p>
        Kullanıcı İçeriğinin ya da Çıktıların Koşullara veya mevzuata aykırı kullanımı nedeniyle üçüncü kişilerin ya
        da kamu kurumlarının Şirket&apos;e yönelttiği talepler sonucunda doğan zarar, ceza ve makul avukatlık
        giderlerini karşılamayı kabul edersiniz.
      </p>

      <h2>11. Askıya alma ve fesih</h2>
      <ol>
        <li>Hesabınızı dilediğiniz zaman kapatabilirsiniz. Kapatma talebinizi <a href={`mailto:${site.email}`}>{site.email}</a> adresine iletebilirsiniz; kullanılmamış kredilerinizin durumu Mesafeli Satış Sözleşmesi&apos;ne göre değerlendirilir.</li>
        <li>Koşullara aykırılık, hukuka aykırı kullanım şüphesi, ödemenin geri çekilmesi ya da hizmetin güvenliğini tehdit eden bir durumda hesabınızı önceden bildirimde bulunarak, acil hâllerde bildirimsiz olarak askıya alabilir ya da kapatabiliriz.</li>
        <li>Hesabın kapanmasıyla Çıktılara panel üzerinden erişim sona erer. Videolarınızı hesabınızı kapatmadan önce indirmenizi öneririz.</li>
      </ol>

      <h2>12. Koşullarda değişiklik</h2>
      <p>
        Koşulları mevzuat değişiklikleri ya da hizmetteki gelişmeler doğrultusunda güncelleyebiliriz. Haklarınızı
        esaslı şekilde etkileyen değişiklikleri yürürlüğe girmeden en az 15 gün önce e-posta ya da panel bildirimiyle
        duyururuz. Değişiklik sonrasında hizmeti kullanmaya devam etmeniz güncel Koşulları kabul ettiğiniz anlamına
        gelir; kabul etmiyorsanız hesabınızı kapatabilirsiniz.
      </p>

      <h2>13. Bildirimler ve delil</h2>
      <p>
        Size yapılacak bildirimler, hesabınızda kayıtlı e-posta adresine ya da panel üzerinden yapılır. Taraflar
        arasındaki uyuşmazlıklarda Şirket&apos;in elektronik kayıtları, sunucu ve işlem kayıtları 6100 sayılı Hukuk
        Muhakemeleri Kanunu m. 193 uyarınca delil teşkil eder; bu hüküm tüketicilerin karşı delil sunma hakkını
        ortadan kaldırmaz.
      </p>

      <h2>14. Uygulanacak hukuk ve uyuşmazlıkların çözümü</h2>
      <p>
        Bu Koşullar Türkiye Cumhuriyeti hukukuna tabidir. Tüketiciler, Ticaret Bakanlığı&apos;nca her yıl belirlenen
        parasal sınırlar dahilinde yerleşim yerlerindeki ya da işlemi yaptıkları yerdeki Tüketici Hakem Heyetine,
        bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemesine başvurabilir. Tacir ya da esnaf sıfatıyla hizmet alan
        Kullanıcılarla doğacak uyuşmazlıklarda Şirket merkezinin bulunduğu yer mahkemeleri ve icra daireleri
        yetkilidir.
      </p>

      <h2>15. Yürürlük</h2>
      <p>
        Bu Koşullar, hesap oluşturduğunuz anda yürürlüğe girer ve hesabınız açık kaldığı sürece geçerlidir. Kişisel
        verilerinizin işlenmesine ilişkin bilgiler <Link href="/kvkk">KVKK Aydınlatma Metni</Link>,{" "}
        <Link href="/gizlilik">Gizlilik Politikası</Link> ve <Link href="/cerez">Çerez Politikası</Link>&apos;nda yer
        alır; bu metinler Koşulların ayrılmaz parçasıdır.
      </p>
    </LegalPage>
  );
}
