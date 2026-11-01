import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Çerez politikası", alternates: { canonical: "/cerez" } };

export default function Page() {
  return (
    <LegalPage title="Çerez politikası" updated="1 Kasım 2026" current="/cerez">
      <p>
        Bu politika, Arsa Video internet sitesinde ve kullanıcı panelinde kullanılan çerezleri ve benzeri
        teknolojileri açıklar. Arsa Video yalnızca hizmetin çalışması için zorunlu olan çerezleri kullanır; reklam,
        hedefleme ya da siteler arası takip çerezi kullanılmaz.
      </p>

      <h2>1. Çerez nedir?</h2>
      <p>
        Çerezler, ziyaret ettiğiniz internet sitesi tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır.
        Yerel depolama (local storage) ise benzer şekilde tarayıcınızda tutulan ve yalnızca sizin cihazınızda kalan
        bir veri alanıdır.
      </p>

      <h2>2. Kullandığımız çerezler</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Ad</th><th>Tür</th><th>Amaç</th><th>Süre</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>__Secure-better-auth.session_token</code></td>
              <td>Zorunlu, birinci taraf</td>
              <td>Giriş yaptığınızda oluşturulur; panelde oturumunuzun açık kalmasını ve hesabınızın güvenliğini sağlar.</td>
              <td>30 gün ya da çıkış yapana kadar</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Zorunlu çerezler, KVKK m. 5/2-c (sözleşmenin ifası) ve m. 5/2-f (meşru menfaat) kapsamında açık rıza
        alınmadan kullanılır; bu çerezler olmadan panele giriş yapılamaz.
      </p>

      <h2>3. Yerel depolama</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Anahtar</th><th>Amaç</th><th>Süre</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>arsa-video:office</code></td>
              <td>Sipariş formunda bir sonraki videoda tekrar yazmamanız için ofis adınızı ve telefonunuzu hatırlar.</td>
              <td>Siz silene kadar</td>
            </tr>
            <tr>
              <td><code>aktar-sablon</code></td>
              <td>Şablonlar arasında geçerken en son seçtiğiniz şablonu hatırlar.</td>
              <td>Siz silene kadar</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Bu bilgiler yalnızca tarayıcınızda tutulur, sunucularımıza gönderilmez.</p>

      <h2>4. Ziyaret ölçümü</h2>
      <p>
        Sayfa ziyaretlerini, Avrupa Birliği&apos;nde barındırılan ve çerez kullanmayan Plausible Analytics ile
        sayarız. Bu araç IP adresinizi saklamaz, sizi siteler ya da günler arasında tanımaz ve kişisel profil
        oluşturmaz; yalnızca toplu sayılar (sayfa görüntülenmesi, yönlendiren site, ülke, cihaz türü) üretir. Bu
        nedenle çerez onayı istemiyoruz.
      </p>

      <h2>5. Çerezleri yönetmek</h2>
      <p>
        Tarayıcınızın ayarlarından çerezleri ve yerel depolamayı görüntüleyebilir, silebilir ya da
        engelleyebilirsiniz. Oturum çerezini engellerseniz panele giriş yapamazsınız. Yaygın tarayıcıların çerez
        ayarları genellikle &quot;Ayarlar &gt; Gizlilik ve güvenlik&quot; menüsünde yer alır.
      </p>

      <h2>6. Değişiklikler ve iletişim</h2>
      <p>
        İleride zorunlu olmayan bir çerez kullanmamız gerekirse bu politikayı güncelleyecek ve çerezi kullanmadan önce
        onayınızı alacağız. Kişisel verilerinizin işlenmesine ilişkin ayrıntılar{" "}
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde yer alır. Sorularınız için{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalPage>
  );
}
