/** Pazarlama sitesinin sabitleri. Yasal sayfalar şirket bilgisini buradan okur. */
export const site = {
  name: "Arsa Video",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
  description:
    "Emlak için şablonlu tanıtım videoları: parsel dosyasından drone turu, ilan fotoğraflarından sinematik video, boş arsadan inşaat timelapse'i.",
  email: "info@eticajans.com",
  // TODO(yayın öncesi): veri sorumlusunun resmi bilgileri — KVKK metni bunları gösterir.
  company: {
    title: "Etic Ajans",
    address: "Adres bilgisi eklenecek",
    mersis: "",
  },
};

export const nav = [
  { href: "/sablonlar", label: "Şablonlar" },
  { href: "/#nasil-calisir", label: "Nasıl çalışır" },
  { href: "/#sss", label: "SSS" },
  { href: "/iletisim", label: "İletişim" },
];

export const legal = [
  { href: "/kvkk", label: "KVKK aydınlatma metni" },
  { href: "/gizlilik", label: "Gizlilik politikası" },
  { href: "/cerez", label: "Çerez politikası" },
  { href: "/kullanim-kosullari", label: "Kullanım koşulları" },
];
