import type { Metadata } from "next";
import Link from "next/link";
import { CompanyDetails, LegalPage } from "@/components/site/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mesafeli satış sözleşmesi",
  alternates: { canonical: "/mesafeli-satis" },
};

// TODO(yayın öncesi): hukuki inceleme; satıcı bilgileri lib/site.ts içinde. Ödeme altyapısı bağlanınca kart ödemesi ve
// ödeme ekranındaki onay kutusu buraya göre güncellenir.
export default function Page() {
  return (
    <LegalPage title="Mesafeli satış sözleşmesi" updated="1 Kasım 2026" current="/mesafeli-satis">
      <p>
        Bu metin, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca
        hazırlanmış Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi&apos;nden oluşur. Kredi satın almadan önce
        bu bilgileri okumanızı rica ederiz; ödeme yaparak bu bilgileri okuduğunuzu ve sözleşmeyi elektronik ortamda
        kabul ettiğinizi beyan edersiniz.
      </p>

      <h2>Bölüm A: Ön bilgilendirme formu</h2>

      <h3>A.1 Satıcı</h3>
      <CompanyDetails />

      <h3>A.2 Hizmetin temel nitelikleri</h3>
      <p>
        Satışa konu hizmet, Arsa Video paneli üzerinden şablonlu tanıtım videosu üretiminde kullanılan dijital
        kredilerdir. Her şablonun kredi karşılığı sipariş ekranında videonuzu onaylamadan önce gösterilir; krediler
        yalnızca Arsa Video hizmetinde kullanılabilir.
      </p>

      <h3>A.3 Fiyat ve ödeme</h3>
      <ul>
        <li>Kredi paketlerinin vergiler dahil toplam fiyatı, satın alma sırasında Türk lirası olarak gösterilir. Teslimat ya da ek masraf alınmaz.</li>
        <li>Ödeme banka havalesi/EFT ya da kredi/banka kartı ile yapılır. Havale/EFT ödemelerinde açıklama alanına hesabınıza kayıtlı e-posta adresini yazmanız gerekir.</li>
        <li>Kart ile ödemelerde kart bilgileri doğrudan lisanslı ödeme kuruluşu tarafından işlenir; Satıcı kart bilgilerinizi görmez ve saklamaz.</li>
      </ul>

      <h3>A.4 İfa</h3>
      <p>
        Krediler, ödemenin Satıcı hesabına geçtiğinin doğrulanmasıyla hesabınıza tanımlanır; bu süre kartla
        ödemelerde anlık, havale/EFT ödemelerinde iş günlerinde genellikle aynı gündür. Krediyle verilen video
        siparişleri, sipariş ekranında belirtilen tahmini sürede üretilir ve panelinize teslim edilir.
      </p>

      <h3>A.5 Cayma hakkı</h3>
      <p>
        Tüketici sıfatıyla satın aldığınız krediler için, hiç kullanılmamış olmaları şartıyla satın alma tarihinden
        itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkınız vardır.
        Bir krediyi video siparişinde kullandığınızda, onayınızla ifasına başlanmış ve elektronik ortamda anında ifa
        edilen bir hizmet söz konusu olduğundan Mesafeli Sözleşmeler Yönetmeliği m. 15 uyarınca harcanan krediler
        için cayma hakkı kullanılamaz. Ayrıntılar aşağıdaki B.5 maddesindedir.
      </p>

      <h3>A.6 Şikâyet ve itiraz</h3>
      <p>
        Şikâyetlerinizi <a href={`mailto:${site.email}`}>{site.email}</a> adresine iletebilirsiniz. Uyuşmazlık
        hâlinde Ticaret Bakanlığı&apos;nca her yıl belirlenen parasal sınırlar dahilinde Tüketici Hakem Heyetine,
        bu sınırları aşan durumlarda Tüketici Mahkemesine başvurabilirsiniz. Tüketici Hakem Heyeti başvurusu
        e-Devlet üzerinden Tüketici Bilgi Sistemi (TÜBİS) ile de yapılabilir.
      </p>

      <h2>Bölüm B: Mesafeli satış sözleşmesi</h2>

      <h3>B.1 Taraflar</h3>
      <p>
        Bu sözleşme, yukarıda bilgileri yer alan Satıcı ile Arsa Video hizmetine üye olarak kredi satın alan Alıcı
        arasında, Alıcının ödemeyi tamamladığı anda elektronik ortamda kurulmuştur. Alıcının bilgileri, hesabında ve
        ödeme kaydında yer alan bilgilerdir.
      </p>

      <h3>B.2 Konu</h3>
      <p>
        Sözleşmenin konusu, Alıcının elektronik ortamda sipariş verdiği kredi paketinin satışı ile bu kredilerle
        verilen video siparişlerinin <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>&apos;na uygun olarak
        üretilmesine ilişkin tarafların hak ve yükümlülüklerinin belirlenmesidir.
      </p>

      <h3>B.3 Kredilerin kullanımı</h3>
      <ol>
        <li>Krediler, hesabınız açık kaldığı sürece geçerlidir; kullanım süresi sınırı yoktur.</li>
        <li>Krediler kişiye özeldir; başka bir hesaba devredilemez, nakde çevrilemez ve Arsa Video dışında kullanılamaz.</li>
        <li>Sipariş onaylandığında şablonun kredi karşılığı bakiyeden düşülür. Kredi karşılıkları ileride değişebilir; verilmiş siparişler sipariş anındaki karşılıkla tamamlanır.</li>
        <li>Promosyon ya da deneme amacıyla ücretsiz tanımlanan krediler satın alınmış sayılmaz ve iade konusu olmaz.</li>
      </ol>

      <h3>B.4 Satıcının yükümlülükleri</h3>
      <ol>
        <li>Satıcı, video siparişini sipariş ekranında belirtilen şablonun niteliklerine uygun olarak üretmekle yükümlüdür.</li>
        <li>Teknik bir arıza nedeniyle üretilemeyen ya da şablonun temel niteliklerini taşımayan videoların kredisi, Alıcının talebi aranmaksızın ya da talebi üzerine hesabına iade edilir veya video yeniden üretilir.</li>
        <li>Alıcının yanlış ya da eksik bilgi girmesi, uygun olmayan dosya yüklemesi gibi kendisinden kaynaklanan nedenlerle beklentiyi karşılamayan videolar ayıplı sayılmaz.</li>
      </ol>

      <h3>B.5 Cayma hakkı ve kullanımı</h3>
      <ol>
        <li>Tüketici, hiç kullanmadığı krediler için satın alma tarihinden itibaren 14 gün içinde cayma hakkını kullanabilir.</li>
        <li>Paketteki kredilerin bir kısmı kullanılmışsa cayma hakkı, kullanılmamış krediler için paketin birim fiyatı üzerinden orantılı olarak kullanılabilir.</li>
        <li>Video siparişinde harcanan krediler için, siparişin Alıcının onayıyla verilmesi ve hizmetin elektronik ortamda anında ifasına başlanması nedeniyle Mesafeli Sözleşmeler Yönetmeliği m. 15 uyarınca cayma hakkı bulunmaz. Alıcı, sipariş ekranındaki onayıyla bunu kabul eder.</li>
        <li>Cayma bildirimi, hesaba kayıtlı e-posta adresinden <a href={`mailto:${site.email}`}>{site.email}</a> adresine açık bir beyanla yapılır.</li>
        <li>Satıcı, cayma bildiriminin kendisine ulaştığı tarihten itibaren en geç 14 gün içinde iade tutarını, ödemenin yapıldığı ödeme aracıyla ya da havale/EFT ile Alıcının bildirdiği kendi adına kayıtlı banka hesabına ve herhangi bir masraf yüklemeden iade eder. İade edilen krediler hesaptan düşülür.</li>
      </ol>

      <h3>B.6 Ayıplı hizmet</h3>
      <p>
        Hizmetin ayıplı olması hâlinde tüketici, 6502 sayılı Kanun m. 15 uyarınca hizmetin yeniden görülmesi, ayıp
        oranında bedel indirimi ya da sözleşmeden dönme haklarından birini kullanabilir. Satıcı, bu talepleri en geç
        30 gün içinde yerine getirir.
      </p>

      <h3>B.7 Tacir ve esnaf alıcılar</h3>
      <p>
        Krediyi ticari ya da mesleki amaçla satın alan Alıcılar (emlak ofisleri, şirketler) tüketici sayılmaz; bu
        Alıcılar bakımından cayma hakkına ilişkin B.5 maddesi uygulanmaz ve iade talepleri Satıcının takdirine
        bağlıdır. Teknik arıza nedeniyle kredi iadesine ilişkin B.4/2 maddesi tüm Alıcılar için geçerlidir.
      </p>

      <h3>B.8 Fatura</h3>
      <p>
        Her kredi satın alımı için, Alıcının hesabında ya da ödeme sırasında bildirdiği bilgilere göre e-Fatura veya
        e-Arşiv fatura düzenlenir ve kayıtlı e-posta adresine gönderilir.
      </p>

      <h3>B.9 Kişisel veriler</h3>
      <p>
        Sözleşmenin kurulması ve ifası için işlenen kişisel veriler hakkında bilgi{" "}
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde yer alır.
      </p>

      <h3>B.10 Uyuşmazlıkların çözümü</h3>
      <p>
        Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Tüketici Alıcılar, A.6 maddesinde belirtilen Tüketici Hakem
        Heyetlerine ve Tüketici Mahkemelerine başvurabilir. Tacir ya da esnaf Alıcılarla doğacak uyuşmazlıklarda
        Satıcı merkezinin bulunduğu yer mahkemeleri ve icra daireleri yetkilidir.
      </p>

      <h3>B.11 Yürürlük</h3>
      <p>
        Alıcı, ödemeyi tamamlamadan önce bu Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi&apos;ni okuduğunu,
        tüm koşulları anladığını ve elektronik ortamda onayladığını kabul eder. Sözleşme ödemenin tamamlandığı anda
        yürürlüğe girer. Sözleşmenin bir örneği talep hâlinde Alıcının kayıtlı e-posta adresine gönderilir ve Satıcı
        tarafından en az üç yıl saklanır.
      </p>
    </LegalPage>
  );
}
