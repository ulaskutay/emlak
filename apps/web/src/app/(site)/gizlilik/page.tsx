import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Gizlilik politikası", alternates: { canonical: "/gizlilik" } };

export default function Page() {
  return (
    <LegalPage title="Gizlilik politikası" updated="18 Ekim 2026">
      <p>
        Arsa Video, videonuzu üretmek için gereken bilgiden fazlasını istemez. Kişisel verilerin hangi amaçla ve hangi
        hukuki sebeple işlendiği <Link href="/kvkk">KVKK aydınlatma metninde</Link> ayrıntılı olarak yer alır.
      </p>

      <h2>Yüklediğiniz dosyalar ve videolar</h2>
      <p>
        Parsel dosyanız ve ürettiğiniz videolar yalnızca sizin hesabınızda görünür. Video bağlantıları süreli olarak
        imzalanır; bağlantıyı paylaştığınız kişiler videoyu bu süre boyunca izleyebilir. Videolarınızı örnek olarak
        sitede göstermek istersek önce sizden izin alırız.
      </p>

      <h2>Ziyaret ölçümü</h2>
      <p>
        Sitenin hangi sayfalarının ziyaret edildiğini, çerez kullanmayan ve kişiyi tanımlamayan bir ölçüm aracıyla
        sayarız. Ayrıntılar <Link href="/cerez">çerez politikasında</Link>.
      </p>

      <h2>Güvenlik</h2>
      <p>
        Şifreler geri döndürülemez biçimde saklanır, tüm bağlantılar HTTPS üzerinden kurulur ve verilere yalnızca
        hizmeti sunmak için gereken kişiler erişir.
      </p>

      <h2>Hesabınızı silmek</h2>
      <p>
        Hesabınızın ve videolarınızın silinmesini <a href={`mailto:${site.email}`}>{site.email}</a> adresine yazarak
        isteyebilirsiniz.
      </p>
    </LegalPage>
  );
}
