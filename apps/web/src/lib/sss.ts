import { templateList } from "@arsa/shared";

/** Sık sorulanlar: /sss sayfası ve FAQPage yapılandırılmış verisi. */
export const sss = [
  {
    s: "Hangi videoları hazırlayabilirim?",
    c: `Şu anda ${templateList.length} şablon var: ${templateList.map((t) => t.name.toLocaleLowerCase("tr")).join(", ")}. Her birinin panelde nasıl hazırlandığını "Nasıl yapılır" sayfasındaki kayıtlardan izleyebilirsiniz; yeni şablonlar ekledikçe şablonlar sayfasında görünür.`,
  },
  {
    s: "Parsel dosyasını nereden alırım?",
    c: "parselsorgu.tkgm.gov.tr adresinde il, ilçe, mahalle, ada ve parseli seçin; sonuç ekranından KML ya da GeoJSON dosyasını indirin. Arsa Video'ya bu dosyayı yüklemeniz yeterli.",
  },
  {
    s: "Çekim ekibi ya da drone gerekiyor mu?",
    c: "Hayır. Arsa şablonları Google'ın uydu ve 3D harita görüntüleri üzerinde uçan sanal bir kamerayla, ilan şablonu ise elinizdeki fotoğraflardan hazırlanır. Mülke gitmeniz gerekmez.",
  },
  {
    s: "Harita görüntüleri güncel mi?",
    c: "Arsa şablonlarındaki görüntüler Google'ın harita verisinden gelir; çekim tarihi bölgeye göre birkaç yıl öncesine ait olabilir. Parsel sınırı ise doğrudan TKGM dosyanızdan çizilir.",
  },
  {
    s: "Video ne kadar sürede hazır olur?",
    c: "Siparişten sonra genellikle birkaç dakika. Aşamaları panelde canlı izlersiniz; video hazır olduğunda indirip paylaşabilirsiniz.",
  },
  {
    s: "Videoyu nerede kullanabilirim?",
    c: "Video dikey (9:16) hazırlanır: Instagram Reels, TikTok, YouTube Shorts, WhatsApp durumu ve ilan sitelerinin video alanı için uygundur.",
  },
  {
    s: "Ücreti ne kadar?",
    c: "Şu anda ücretsiz deneyebilirsiniz. Ücretli paketler yayına girmeden önce kayıtlı kullanıcılara e-postayla duyurulacak.",
  },
];
