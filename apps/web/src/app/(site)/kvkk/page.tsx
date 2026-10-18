import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "KVKK aydınlatma metni", alternates: { canonical: "/kvkk" } };

// TODO(yayın öncesi): hukuki inceleme; veri sorumlusu bilgileri lib/site.ts içinde.
export default function Page() {
  const c = site.company;
  return (
    <LegalPage title="KVKK aydınlatma metni" updated="18 Ekim 2026">
      <p>
        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, Arsa Video hizmetini kullanırken
        işlenen kişisel verileriniz hakkında sizi bilgilendirmek için hazırlanmıştır.
      </p>

      <h2>Veri sorumlusu</h2>
      <p>
        {c.title}
        {c.address && `, ${c.address}`}
        {c.mersis && ` (MERSİS: ${c.mersis})`}. İletişim: <a href={`mailto:${site.email}`}>{site.email}</a>
      </p>

      <h2>İşlenen veriler</h2>
      <ul>
        <li>Kimlik ve iletişim: ad soyad ya da ofis adı, e-posta adresi, videoya eklediğiniz telefon numarası.</li>
        <li>Hesap güvenliği: şifrenizin geri döndürülemez özeti, oturum kayıtları, IP adresi ve tarayıcı bilgisi.</li>
        <li>
          Yüklediğiniz içerik: parsel dosyası (ada, parsel, konum, alan, nitelik), fiyat ve imar bilgisi, seçtiğiniz
          çevre noktaları ve üretilen videolar.
        </li>
      </ul>

      <h2>İşleme amaçları ve hukuki sebepler</h2>
      <ul>
        <li>Hesabınızı açmak ve sipariş ettiğiniz videoyu üretmek: sözleşmenin kurulması ve ifası (KVKK m. 5/2-c).</li>
        <li>Hizmet güvenliğini sağlamak ve kötüye kullanımı önlemek: meşru menfaat (KVKK m. 5/2-f).</li>
        <li>Yasal yükümlülükleri yerine getirmek: kanunlarda açıkça öngörülme (KVKK m. 5/2-a, 5/2-ç).</li>
      </ul>

      <h2>Aktarım</h2>
      <p>
        Video üretimi için verilerin bir kısmı, hizmeti birlikte sunduğumuz altyapı sağlayıcılarına aktarılır:
        sunucu ve veritabanı barındırma, video dosyalarının saklanması (Cloudflare R2), harita ve çevre bilgisi (Google
        Maps Platform), seslendirme (ElevenLabs) ve görüntü işleme (RunPod). Bu sağlayıcıların bir kısmı yurt
        dışındadır; aktarım KVKK m. 9&apos;daki şartlara uygun olarak yapılır. Verileriniz reklam amacıyla üçüncü
        kişilere satılmaz.
      </p>

      <h2>Saklama süresi</h2>
      <p>
        Hesap verileri hesabınız açık kaldığı sürece, videolar ve yüklediğiniz dosyalar siz silene ya da hesabınızı
        kapatana kadar saklanır. Yasal saklama yükümlülüğü olan kayıtlar ilgili süre boyunca tutulur.
      </p>

      <h2>Haklarınız</h2>
      <p>
        KVKK m. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da
        silinmesini isteme, aktarıldığı kişileri öğrenme ve itiraz etme haklarına sahipsiniz. Başvurularınızı{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> adresine iletebilirsiniz; en geç 30 gün içinde yanıtlanır.
      </p>
    </LegalPage>
  );
}
