import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Çerez politikası", alternates: { canonical: "/cerez" } };

export default function Page() {
  return (
    <LegalPage title="Çerez politikası" updated="18 Ekim 2026">
      <p>Arsa Video yalnızca hizmetin çalışması için zorunlu çerezleri kullanır. Reklam ya da takip çerezi yoktur.</p>

      <h2>Kullanılan çerezler</h2>
      <ul>
        <li>
          Oturum çerezi: giriş yaptığınızda oluşturulur, panelde oturumunuzun açık kalmasını sağlar. Çıkış yaptığınızda
          ya da süresi dolduğunda silinir.
        </li>
      </ul>

      <h2>Ziyaret ölçümü</h2>
      <p>
        Sayfa ziyaretlerini çerez kullanmayan bir araçla sayarız. Bu araç IP adresinizi saklamaz ve sizi siteler
        arasında takip etmez; bu yüzden bir çerez onayı istemiyoruz.
      </p>

      <h2>Çerezleri kapatmak</h2>
      <p>
        Tarayıcınızın ayarlarından çerezleri silebilir ya da engelleyebilirsiniz. Oturum çerezi engellenirse panele
        giriş yapamazsınız.
      </p>
    </LegalPage>
  );
}
