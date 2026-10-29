import { z } from "zod";
import { ListingDetails, TOUR_MAX_WORDS } from "./listing-text.js";
import { PresenterId, type PresenterInfo } from "./presenters.js";
import { REEL_STAGES, ReelListing, ReelOrder } from "./reel.js";

/**
 * Video şablonları: galeri, sipariş formu, API ve worker aynı tanımı kullanır.
 * Yeni şablon = buraya tanım + sipariş şeması + apps/worker/src/templates altında üretim hattı.
 */
export const TEMPLATE_IDS = ["arsa-drone", "ilan-videosu", "bitmis-hali", "insaat-videosu", "dosenmis-ev", "sunucu-ev"] as const;
export const TemplateId = z.enum(TEMPLATE_IDS);
export type TemplateId = z.infer<typeof TemplateId>;

export const TEMPLATE_CATEGORIES = ["Arsa", "Konut", "Proje", "Sosyal medya"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  /** Galeri kartındaki tek cümle. */
  tagline: string;
  description: string;
  category: TemplateCategory;
  /** Kullanıcının hazırlaması gerekenler. */
  needs: string[];
  /** Videoda neler var. */
  includes: string[];
  duration: string;
  /** Örnek video ve kapak (public/ altında). Video yoksa yalnız kapak gösterilir. */
  preview: { video?: string; poster: string };
  badge?: "Yeni";
  /** Geliştirme aşamasında: galeride, sayfada ve siparişte görünmez (kod ve eski videolar çalışır). */
  hidden?: boolean;
  stages: readonly { id: string; label: string }[];
}

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  "arsa-drone": {
    id: "arsa-drone",
    name: "Arsa drone turu",
    tagline: "Parsel dosyasından seslendirmeli havadan tanıtım",
    description:
      "Kamera parselin üzerinden kalkar, sınırı çizer, çevredeki deniz, okul ve köy merkezine uçup geri döner. Ada/parsel, alan ve nitelik kartları, Türkçe seslendirme, altyazı ve müzikle.",
    category: "Arsa",
    needs: ["TKGM parsel dosyası (KML ya da GeoJSON)", "Fiyat, imar durumu ve ofis telefonu (isteğe bağlı)"],
    includes: ["Parsel sınırı ve kenar uzunlukları", "Çevre noktalarına uçuş", "Türkçe seslendirme ve altyazı", "Müzik ve geçiş efektleri"],
    duration: "25–35 sn",
    preview: { video: "/media/ornek-reel.mp4", poster: "/media/ornek-reel-poster.jpg" },
    stages: REEL_STAGES,
  },
  "ilan-videosu": {
    id: "ilan-videosu",
    name: "Fotoğraftan ilan videosu",
    tagline: "İlan fotoğrafları sinematik kamera hareketiyle canlanır",
    description:
      "Her fotoğraf yapay zekâyla birkaç saniyelik bir kamera hareketine dönüşür: dış cephede yükselen drone, salonda yavaş yaklaşma. Üzerine başlıklar, sonunda fiyat ve telefon kartı.",
    category: "Konut",
    needs: ["3–8 ilan fotoğrafı", "Her fotoğraf için kısa başlık (isteğe bağlı)", "Fiyat ve ofis telefonu (isteğe bağlı)"],
    includes: ["Fotoğraf başına sinematik kamera hareketi", "Sahne başlıkları", "Fiyat ve iletişim kartı", "Müzik"],
    duration: "15–30 sn",
    preview: { video: "/media/sablon-ilan.mp4", poster: "/media/sablon-ilan-poster.jpg" },
    badge: "Yeni",
    stages: [
      { id: "photos", label: "Fotoğraflar" },
      { id: "clips", label: "Sahneler" },
      { id: "music", label: "Müzik" },
      { id: "compose", label: "Kurgu" },
      { id: "done", label: "Hazır" },
    ],
  },
  "bitmis-hali": {
    id: "bitmis-hali",
    name: "Arsanın bitmiş hali",
    tagline: "Boş arsadan yükselen projeyi gösteren inşaat timelapse'i",
    description:
      "Önce parselin drone çekimi, sonra aynı kareden yapay zekâyla inşaat timelapse'i: temel kazılır, kat kat yükselir, seçtiğiniz yapı tipi ortaya çıkar. Görüntü temsilidir ve videoda bu yazılır.",
    category: "Proje",
    needs: ["TKGM parsel dosyası (KML ya da GeoJSON)", "Yapı tipi ve kat sayısı", "Fiyat ve ofis telefonu (isteğe bağlı)"],
    includes: ["Parselin drone çekimi", "İnşaat timelapse'i (temsili)", "Proje ve fiyat kartı", "Müzik"],
    duration: "20–30 sn",
    preview: { poster: "/media/sablon-bitmis-poster.jpg" },
    badge: "Yeni",
    stages: [
      { id: "parcel", label: "Parsel" },
      { id: "render", label: "Drone çekimi" },
      { id: "build", label: "Bitmiş hali" },
      { id: "timelapse", label: "İnşaat sahnesi" },
      { id: "compose", label: "Kurgu" },
      { id: "done", label: "Hazır" },
    ],
  },
  "insaat-videosu": {
    id: "insaat-videosu",
    name: "Arsadan inşaat videosu",
    tagline: "Boş arsada kazıdan bitmiş binaya, imar bilgisiyle seslendirilen inşaat",
    description:
      "Arsa yandan, yakından görünür; yapay zekâ önce temeli kazar, sonra binayı kat kat yükseltir ve peyzajı tamamlar. Emsal, inşaat alanı ve TAKS ekranda yazar ve seslendirilir, inşaat sesleri ve müzikle. Sonunda emlakçı kartı. Görüntü temsilidir ve videoda bu yazılır.",
    category: "Proje",
    needs: [
      "TKGM parsel dosyası (KML ya da GeoJSON)",
      "Yapı tipi ve kat sayısı",
      "İmar durumu: emsal ve TAKS",
      "Fiyat, emlakçı fotoğrafı ve ofis logosu (isteğe bağlı)",
    ],
    includes: [
      "Arsanın yandan yakın çekimi",
      "Kazıdan bitmiş yapıya inşaat timelapse'i (temsili)",
      "Alan, emsal ve TAKS kartları",
      "Türkçe seslendirme, inşaat sesleri ve müzik",
      "Emlakçı kapanış kartı",
    ],
    duration: "~24 sn",
    preview: { video: "/media/sablon-insaat.mp4", poster: "/media/sablon-insaat-poster.jpg" },
    badge: "Yeni",
    stages: [
      { id: "parcel", label: "Parsel" },
      { id: "side", label: "Yan çekim" },
      { id: "build", label: "Bitmiş hali" },
      { id: "timelapse", label: "İnşaat sahnesi" },
      { id: "compose", label: "Kurgu" },
      { id: "sound", label: "Ses" },
      { id: "done", label: "Hazır" },
    ],
  },
  "dosenmis-ev": {
    id: "dosenmis-ev",
    name: "Boş evi döşe",
    tagline: "Boş ilan fotoğraflarına yapay zekâ eşya dizer, ev yaşanır hale gelir",
    description:
      "Boş ya da eşyası eskimiş odaların ilan fotoğraflarını yükleyin, oda tipini ve döşeme tarzını seçin. Yapay zekâ her odayı döşer; videoda boş oda gözünüzün önünde eşyalanır. Duvar, pencere ve zemin aynı kalır. Görüntü temsilidir ve videoda bu yazılır.",
    category: "Konut",
    needs: ["2–4 boş oda fotoğrafı (sahibinden.com ilanındaki fotoğraflar olur)", "Her fotoğraf için oda tipi", "Döşeme tarzı", "İlan sayfasının metni (seslendirme için, isteğe bağlı)"],
    includes: ["Oda başına döşenme sahnesi (temsili)", "İlan bilgisinden Türkçe seslendirme", "Oda başlıkları", "Fiyat ve iletişim kartı", "Müzik"],
    duration: "21 sn",
    preview: { video: "/media/sablon-dosenmis.mp4", poster: "/media/sablon-dosenmis-poster.jpg" },
    badge: "Yeni",
    stages: [
      { id: "photos", label: "Fotoğraflar" },
      { id: "staging", label: "Döşeme" },
      { id: "clips", label: "Sahneler" },
      { id: "compose", label: "Kurgu" },
      { id: "done", label: "Hazır" },
    ],
  },
  "sunucu-ev": {
    id: "sunucu-ev",
    name: "Sunuculu ev turu",
    tagline: "Sanal emlak sunucusu evi oda oda gezdirip kameraya anlatır",
    description:
      "İlanı aktarın, fotoğrafları salon, oda ya da binanın dışı diye işaretleyin. Seçtiğiniz sanal sunucu her sahnede birkaç adım atarak alanı kameraya Türkçe anlatır: ilk sahnede ilanın kimliği, aradakilerde öne çıkanlar ve yakın yerler, sonda fiyat ve çağrı. Metni düzenleyebilirsiniz; konuşma kelime kelime altyazıyla yazılır. İsterseniz boş odalar önce döşenir. Sunucu ve döşeme temsilidir; videoda bu yazılır.",
    category: "Konut",
    needs: ["2–4 fotoğraf: odalar ve isterseniz binanın dışı (sahibinden.com ilanından aktarılır)", "Her fotoğraf için oda tipi", "İlan linki ya da sayfa metni (anlatım için)"],
    includes: ["Sahne başına odada yürüyerek anlatan sunucu", "İlandan ve yakın yerlerden canlı Türkçe anlatım", "Kelime kelime altyazı", "İsteğe bağlı döşeme (temsili)", "Oda başlıkları, fiyat ve iletişim kartı", "Müzik"],
    duration: "~36 sn",
    preview: { video: "/media/sablon-sunucu-2.mp4", poster: "/media/sablon-sunucu-2-poster.jpg" },
    badge: "Yeni",
    stages: [
      { id: "photos", label: "Fotoğraflar" },
      { id: "staging", label: "Döşeme" },
      { id: "presenter", label: "Sunucu" },
      { id: "clips", label: "Sahneler" },
      { id: "compose", label: "Kurgu" },
      { id: "done", label: "Hazır" },
    ],
  },
};

/** Sitede görünen şablonlar (gizliler hariç). */
export const templateList = TEMPLATE_IDS.map((id) => TEMPLATES[id]).filter((t) => !t.hidden);

/** Galeride "Yakında" olarak görünen, henüz sipariş alınmayan şablonlar (sayfası ve formu yok). */
export interface SoonTemplate {
  slug: string;
  name: string;
  tagline: string;
  category: TemplateCategory;
}

export const SOON_TEMPLATES: SoonTemplate[] = [
  { slug: "mahalle-rehberi", name: "Mahalle rehberi", tagline: "Okul, market, ulaşım: ilanın çevresini anlatan tur", category: "Konut" },
  { slug: "satildi", name: "Satıldı paylaşımı", tagline: "Satılan ilan için ofisinizin imzasıyla kısa duyuru", category: "Sosyal medya" },
  { slug: "fiyat-guncellemesi", name: "Fiyat güncellemesi", tagline: "Fiyatı düşen ilanı öne çıkaran dikey video", category: "Sosyal medya" },
];

// ——— Sipariş şemaları ———

export const ArsaDroneOrder = ReelOrder.extend({ template: z.literal("arsa-drone") });

export const IlanPhoto = z.object({
  /** R2 anahtarı: kullanıcının yüklediği fotoğraf (uploads/<userId>/...). */
  key: z.string().regex(/^uploads\/[\w-]+\/[\w-]+\.jpg$/, "Geçersiz fotoğraf"),
  setting: z.enum(["exterior", "interior"]),
  title: z.string().trim().max(40).optional(),
});
export type IlanPhoto = z.infer<typeof IlanPhoto>;

export const IlanOrder = z.object({
  template: z.literal("ilan-videosu"),
  photos: z.array(IlanPhoto).min(3, "En az 3 fotoğraf seçin").max(8, "En fazla 8 fotoğraf"),
  listing: ReelListing.pick({ priceTry: true, officeName: true, phone: true }).default({}),
  music: z.boolean().default(true),
});
export type IlanOrder = z.infer<typeof IlanOrder>;

export const BuildingType = z.enum(["konut", "villa", "villa_sitesi", "ticari"]);
export type BuildingType = z.infer<typeof BuildingType>;

export const BUILDING_LABELS: Record<BuildingType, string> = {
  konut: "Apartman",
  villa: "Villa",
  villa_sitesi: "Villa sitesi",
  ticari: "Ticari bina",
};

export const BitmisOrder = z.object({
  template: z.literal("bitmis-hali"),
  parcelFileName: z.string().trim().min(1).max(200),
  parcelText: z.string().min(20).max(2_000_000),
  building: BuildingType,
  floors: z.coerce.number().int().min(1).max(12).default(4),
  listing: ReelListing.pick({ priceTry: true, officeName: true, phone: true }).default({}),
  music: z.boolean().default(true),
});
export type BitmisOrder = z.infer<typeof BitmisOrder>;


/** Oda tipleri; "dis_cephe" (binanın dışı / site alanı) yalnız sunuculu turda seçilir (döşenmez). */
export const RoomType = z.enum(["salon", "yatak_odasi", "cocuk_odasi", "mutfak", "yemek_odasi", "calisma_odasi", "banyo", "balkon", "dis_cephe"]);
export type RoomType = z.infer<typeof RoomType>;

export const ROOM_LABELS: Record<RoomType, string> = {
  salon: "Salon",
  yatak_odasi: "Yatak odası",
  cocuk_odasi: "Çocuk odası",
  mutfak: "Mutfak",
  yemek_odasi: "Yemek odası",
  calisma_odasi: "Çalışma odası",
  banyo: "Banyo",
  balkon: "Balkon",
  dis_cephe: "Binanın dışı",
};

export const StagingStyle = z.enum(["modern", "iskandinav", "klasik", "luks", "dogal"]);
export type StagingStyle = z.infer<typeof StagingStyle>;

export const STYLE_LABELS: Record<StagingStyle, string> = {
  modern: "Modern",
  iskandinav: "İskandinav",
  klasik: "Klasik",
  luks: "Lüks",
  dogal: "Doğal / bohem",
};

export const RoomPhoto = IlanPhoto.pick({ key: true, title: true }).extend({
  room: RoomType,
  /** Dikey kırpmanın yatay konumu: 0 sol, 1 sağ (pencere kadraja girsin diye). */
  focusX: z.number().min(0).max(1).default(0.5),
});
export type RoomPhoto = z.infer<typeof RoomPhoto>;

const AgentAsset = z.string().regex(/^uploads\/[\w-]+\/[\w-]+\.(jpg|png)$/, "Geçersiz görsel");

export const DosemeOrder = z.object({
  template: z.literal("dosenmis-ev"),
  photos: z
    .array(RoomPhoto)
    .min(2, "En az 2 fotoğraf seçin")
    .max(4, "En fazla 4 fotoğraf")
    .refine((ps) => ps.every((p) => p.room !== "dis_cephe"), "Binanın dışı döşenemez; yalnız oda fotoğrafları seçin"),
  style: StagingStyle,
  /** Kapanış kartındaki emlakçı (ilan aktarmadan): profil fotoğrafı ve ofis logosu kullanıcının yüklemeleri. */
  agent: z
    .object({
      name: z.string().trim().max(60).optional(),
      photoKey: AgentAsset.optional(),
      logoKey: AgentAsset.optional(),
    })
    .default({}),
  listing: ReelListing.pick({ priceTry: true, officeName: true, phone: true }).default({}),
  details: ListingDetails.default({}),
  voice: z.boolean().default(true),
  voiceId: ReelOrder.shape.voiceId,
  music: z.boolean().default(true),
});
export type DosemeOrder = z.infer<typeof DosemeOrder>;

/** Sunuculu ev turu: döşeme formunun alanları; tarz yoksa odalar olduğu gibi kalır. Ses video modelinden gelir (voiceId yok). */
/** Sunuculu turun sahnesi: fotoğraf + sunucunun söyleyeceği metin (panelde düzenlenir; boşsa tourScript). */
export const TourScene = RoomPhoto.extend({
  text: z
    .string()
    .trim()
    .max(220)
    .refine((t) => t.split(/\s+/).filter(Boolean).length <= TOUR_MAX_WORDS, `Bir sahnede en fazla ${TOUR_MAX_WORDS} kelime (10 saniyeye sığsın)`)
    .optional(),
});
export type TourScene = z.infer<typeof TourScene>;

/** Sunuculu turun kalitesi: video modelinin çözünürlüğü (ikisinde de sonuç 1080p 60 FPS'e büyütülür). */
export const TourQuality = z.enum(["orta", "yuksek"]);
export type TourQuality = z.infer<typeof TourQuality>;

/**
 * Kalite seçenekleri. Sahne başına kullanıcı kredisi fiyat ayarlarında (PricingSettings.tourCredits).
 * Higgsfield maliyeti (2026-10-26, 10 sn'lik sahne): orta ~16,5 kredi (Gemini 360p 10), yüksek ~36,5 (720p 30).
 */
export const TOUR_QUALITY: Record<TourQuality, { label: string; hint: string; resolution: "360p" | "720p" }> = {
  orta: { label: "Orta kalite", hint: "Hızlı ve ekonomik; sosyal medya için yeterli", resolution: "360p" },
  yuksek: { label: "Yüksek kalite", hint: "Daha net yüz ve detay, daha az bozulma", resolution: "720p" },
};

export const SunucuOrder = DosemeOrder.omit({ template: true, photos: true, style: true, voice: true, voiceId: true }).extend({
  template: z.literal("sunucu-ev"),
  photos: z.array(TourScene).min(2, "En az 2 sahne seçin").max(4, "En fazla 4 sahne"),
  style: StagingStyle.optional(),
  presenter: PresenterId.default("defne"),
  quality: TourQuality.default("orta"),
});
export type SunucuOrder = z.infer<typeof SunucuOrder>;

/** İmar durumu (imar durumu belgesinden): seslendirilir ve ekranda kartla yazar. */
export const Zoning = z.object({
  /** İmar türü, ör. "Konut", "Ticari", "Turizm". */
  use: z.string().trim().min(2, "İmar türünü yazın").max(30),
  /** Emsal (KAKS): inşaat alanı = arsa alanı × emsal. */
  emsal: z.coerce.number().min(0.05, "Emsal 0,05 ile 10 arasında olmalı").max(10, "Emsal 0,05 ile 10 arasında olmalı"),
  taks: z.coerce.number().min(0.01, "TAKS 0,01 ile 1 arasında olmalı").max(1, "TAKS 0,01 ile 1 arasında olmalı").optional(),
});
export type Zoning = z.infer<typeof Zoning>;

/** Arsadan inşaat videosu: parsel + yapı tipi + imar; sonunda emlakçı kartı (döşeme şablonundaki gibi). */
export const InsaatOrder = z.object({
  template: z.literal("insaat-videosu"),
  parcelFileName: z.string().trim().min(1).max(200),
  parcelText: z.string().min(20).max(2_000_000),
  building: BuildingType,
  floors: z.coerce.number().int().min(1).max(12).default(4),
  zoning: Zoning,
  agent: DosemeOrder.shape.agent,
  listing: ReelListing.pick({ priceTry: true, officeName: true, phone: true }).default({}),
  voiceId: ReelOrder.shape.voiceId,
  music: z.boolean().default(true),
});
export type InsaatOrder = z.infer<typeof InsaatOrder>;

/** API'nin kabul ettiği sipariş. Şablonsuz eski istek arsa drone turu sayılır. */
export const TemplateOrder = z.preprocess(
  (v) => (v && typeof v === "object" && !("template" in v) ? { ...v, template: "arsa-drone" } : v),
  z.discriminatedUnion("template", [ArsaDroneOrder, IlanOrder, BitmisOrder, InsaatOrder, DosemeOrder, SunucuOrder]),
);
export type TemplateOrder = z.infer<typeof TemplateOrder>;

/** Şablona özgü, satırda saklanan girdi (parsel ve ilan bilgisi ayrı sütunlarda). */
export type TemplateInput =
  | { photos: IlanPhoto[] }
  | { photos: RoomPhoto[]; style: StagingStyle; details?: ListingDetails; agent?: DosemeOrder["agent"]; voice?: boolean }
  | { photos: TourScene[]; style?: StagingStyle; details?: ListingDetails; agent?: DosemeOrder["agent"]; presenter?: PresenterId; quality?: TourQuality }
  | { building: BuildingType; floors: number }
  | { building: BuildingType; floors: number; zoning: Zoning; agent?: DosemeOrder["agent"] }
  | Record<string, never>;

/** Yapı tipine göre görüntü düzenleme tarifi ve videodaki proje adı. */
export function buildingSpec(type: BuildingType, floors: number) {
  const specs: Record<BuildingType, { label: string; edit: string }> = {
    konut: {
      label: `${floors} Katlı Konut Projesi`,
      edit: `a modern ${floors}-storey residential apartment building with white and light grey facade, large windows, glass balconies and a flat roof, with landscaped garden and parking around it`,
    },
    villa: {
      label: "Villa Projesi",
      edit: "a luxury modern two-storey villa with a flat roof, large glass windows, a swimming pool and a landscaped garden",
    },
    villa_sitesi: {
      label: "Villa Sitesi Projesi",
      edit: "a luxury gated community of modern two-storey villas with flat roofs, private swimming pools, landscaped gardens, olive trees and internal roads",
    },
    ticari: {
      label: `${floors} Katlı Ticari Proje`,
      edit: `a modern ${floors}-storey commercial office building with a glass curtain wall facade, ground floor shops and a parking area`,
    },
  };
  return specs[type];
}

/**
 * Wan 2.2 inşaat timelapse'i prompt'u. Lightning modeli CFG'siz çalışır (negatif prompt etkisiz),
 * kaçınılacaklar da buraya yazılır.
 * firstFrameOnly: bitiş karesi yok; model yapıyı yalnız buradan bilir, aşamalar sırayla ve açıkça yazılır.
 */
export function constructionPrompt(building: string, firstFrameOnly = false) {
  if (!firstFrameOnly)
    return (
      "Aerial construction time-lapse from a static drone camera. Excavators dig the foundation inside the glowing outlined plot, " +
      "then a reinforced concrete frame rises floor by floor with scaffolding and a tower crane, workers and trucks move quickly, " +
      `the facade, windows and balconies are completed and the site is cleaned up, revealing ${building}. ` +
      "Fast time-lapse, sunlight and shadows shift across the day, the surroundings stay unchanged, photorealistic."
    );
  return (
    "Fast aerial construction time-lapse, locked-off static drone camera, no camera movement. " +
    "On the empty plot inside the glowing outline, excavators and trucks clear the ground and dig the foundation, " +
    "concrete is poured, then a reinforced concrete frame rises floor by floor with scaffolding and a tower crane, " +
    `walls, windows and the facade are completed, scaffolding and machines are removed, and the finished project stands on the plot: ${building}. ` +
    "The building stays inside the outlined plot. Roads, trees and neighboring buildings stay exactly unchanged. " +
    "Sunlight and shadows move quickly across the day. Photorealistic, sharp, high detail."
  );
}

/**
 * İki parçalı inşaat (yalnız ilk kare): 2. parça 1. parçanın son karesinden başlar.
 * Her parça tek aşamaya odaklanır; 5 sn'ye bütün inşaatı sığdırmaya çalışan tek prompt'ta yapı sonda birden beliriyordu.
 */
export function constructionStagePrompts(building: string): [string, string] {
  const fixed =
    "Locked-off static aerial drone camera, no camera movement. Roads, trees and neighboring buildings stay exactly unchanged. " +
    "Photorealistic, sharp, high detail.";
  return [
    "Fast aerial construction time-lapse, first phase. Inside the glowing outlined plot, excavators, bulldozers and dump trucks " +
      "clear the land and dig a deep foundation pit, a tower crane is erected, concrete foundations are poured, " +
      "then the grey reinforced concrete columns and first floor slabs start rising with scaffolding. Workers and trucks move quickly. " +
      fixed,
    "Fast aerial construction time-lapse, second phase. The concrete frame inside the glowing outlined plot keeps rising floor by floor " +
      "with scaffolding and a tower crane, then walls, windows, balconies and the facade are completed, the crane, scaffolding and machines are removed, " +
      `landscaping is planted and the finished project stands on the plot: ${building}. Sunlight and shadows move quickly across the day. ` +
      fixed,
  ];
}

/** Oda tipine göre eklenecek eşyalar (Qwen-Image-Edit talimatı). */
const ROOM_FURNITURE: Record<RoomType, string> = {
  salon: "living room furniture: a sofa, two armchairs, a coffee table, a TV unit, a rug, a floor lamp, cushions, plants and an elegant chandelier hanging from the ceiling",
  yatak_odasi: "bedroom furniture: a double bed with bedding and pillows, two nightstands with lamps, a rug, a plant and a stylish pendant chandelier hanging from the ceiling",
  cocuk_odasi: "child's room furniture: a single bed with colorful bedding, a small desk and chair, a toy shelf, a playful rug, wall decor and a playful pendant lamp hanging from the ceiling",
  mutfak: "a dining table with chairs, bar stools at the counter, pendant lights, a fruit bowl and plants",
  yemek_odasi: "dining room furniture: a dining table for six with chairs, a pendant chandelier, a sideboard, a rug and a centerpiece",
  calisma_odasi: "home office furniture: a desk, an office chair, a bookshelf with books, a desk lamp, a rug, plants and a modern pendant lamp hanging from the ceiling",
  banyo: "towels, a bath mat, toiletries, a small plant and decor accessories",
  balkon: "balcony furniture: outdoor lounge chairs, a small table, potted plants, an outdoor rug and string lights",
  dis_cephe: "outdoor seating, potted plants and neat landscaping",
};

const STYLE_DETAILS: Record<StagingStyle, string> = {
  modern: "modern style in warm neutral tones with light grey fabric and oak wood",
  iskandinav: "Scandinavian style with light birch wood and white and cream textiles",
  klasik: "elegant classic style with tufted upholstery, dark walnut wood and brass lamps",
  luks: "luxury style with velvet upholstery, marble tables and gold accents",
  dogal: "natural boho style with rattan, linen, jute and many green plants",
};

/**
 * Boş oda fotoğrafını döşeyen görüntü düzenleme talimatı. Kısa tutulur: uzun "şunu koru" listeleri
 * Qwen'i odayı baştan çizmeye itiyordu (açık mutfak silindi, mermer zemin parkeye döndü; 2026-10-22 denemesi).
 * Perde ve "mutfak/dolabı koru" geçmez: perde pencereleri kapatıyor, "mutfak" kelimesi mutfaksız odaya mutfak ekletiyordu.
 * Oda tipi kullanıcıdan gelir: "odaya uygun eşya koy" denince model bütün örnekleri (masa, koltuk, yatak) aynı odaya dolduruyordu.
 */
export function stagingEditPrompt(room: RoomType, style: StagingStyle) {
  const keep = room === "mutfak" ? "the kitchen cabinets and counters, " : "";
  return (
    `Add ${ROOM_FURNITURE[room]} to the open floor space of this room, ${STYLE_DETAILS[style]}. ` +
    `Keep the walls, floor, ceiling and its built-in lighting, windows, doors, ${keep}and everything else in the photo exactly the same. ` +
    "Do not cover or change any window or door, and do not add walls, openings, cabinets or curtains."
  );
}

const ROOM_LABELS_EN: Record<RoomType, string> = {
  salon: "a living room",
  yatak_odasi: "a bedroom",
  cocuk_odasi: "a child's room",
  mutfak: "a kitchen",
  yemek_odasi: "a dining room",
  calisma_odasi: "a home office",
  banyo: "a bathroom",
  balkon: "a balcony",
  dis_cephe: "the outside of the building and its grounds",
};

/**
 * İlk/son kare (boş → döşenmiş) geçiş klibi prompt'u (Gemini Omni Flash). Model ses de üretir; ses kullanılmaz,
 * konuşma çıkmasın diye yalnız ortam sesi istenir.
 */
export function stagingVideoPrompt(room: RoomType) {
  return (
    "Interior design reveal, locked-off static camera, no camera movement. " +
    `In the empty room, furniture and decor for ${ROOM_LABELS_EN[room]} gradually fade in one piece at a time and settle in place, ceiling lights and lamps switch on softly. ` +
    "Calm and smooth, nothing flies or falls. Windows, doors, walls, floor and ceiling stay exactly unchanged and windows stay clear. " +
    "No people. Natural daylight, photorealistic, sharp, high detail. Audio: no speech, only quiet room ambience."
  );
}


/**
 * Sunucuyu sahne fotoğrafına yerleştiren talimat (Seedream 5.0 Pro; 1. referans sahne, 2. ve 3. referans sunucu).
 * Oda ön planda kalsın diye geniş açı ve sunucu kadrajın yarısından kısa, yanda (2026-10-26: tam boy ön plan
 * odayı kapatıyordu). Dış cephede sunucu binanın/sitenin önünde.
 */
export function presenterPlacePrompt(room: RoomType, p: PresenterInfo) {
  const person = p.gender === "female" ? "woman" : "man";
  const pr = p.gender === "female" ? "She" : "He";
  const where =
    room === "dis_cephe"
      ? "in front of the building from the first reference image, on the walkway or garden, with the building facade clearly visible behind"
      : `inside ${ROOM_LABELS_EN[room]} from the first reference image, standing a few steps into the room near one side`;
  return (
    `Place the ${person} from the second and third reference images ${where}. ` +
    "Wide-angle shot that keeps the whole space visible: the room or building stays the main subject and fills most of the frame. " +
    `${pr} appears at medium distance, full body visible, taking up less than half of the frame height, slightly off-center, ` +
    "turned toward the camera with a warm excited smile and one hand open toward the space. " +
    "Keep the space exactly as it is: same walls, floor, ceiling, windows, doors, furniture, facade and camera angle; do not add or remove anything. " +
    `Same face and age, ${p.look}. Realistic lighting and shadows matching the scene, photorealistic, no text.`
  );
}

/**
 * Sunucu klibi (ilk kare + modelin kendi Türkçe sesi). Kamera yavaşça birkaç küçük adım ilerler, sunucu bir iki adım
 * atıp alanı gösterir; geniş hareket modeli odaya olmayan parçalar eklemeye itiyordu (Wan 3.0 denemesi), bu yüzden
 * adımlar küçük. "ışık" gibi noktasız ı'lı kelimeler yanlış okunabiliyor.
 */
export function presenterVideoPrompt(room: RoomType, line: string, p: PresenterInfo) {
  const pr = p.gender === "female" ? "She" : "He";
  const pos = p.gender === "female" ? "Her" : "His";
  const subject = `${p.who.charAt(0).toUpperCase()}${p.who.slice(1)}`;
  const action =
    room === "dis_cephe"
      ? `${subject} is a Turkish real estate agent presenting the building from outside. ${pr} takes a couple of small steps along the walkway and points up at the facade with an open palm. The camera slowly moves a few small steps toward the building, keeping the whole facade in view.`
      : `${subject} is a Turkish real estate agent giving a tour of ${ROOM_LABELS_EN[room]}. ${pr} takes a couple of small steps into the room and points around the space with open palms. The camera smoothly moves forward a few small steps into the room, keeping the room wide and fully visible; ${pos.toLowerCase()} figure stays medium-sized.`;
  return (
    `${action} ${pr} talks to the camera with natural, cheerful facial expressions and lips synchronized to the speech. ` +
    `Keep the space exactly as in the first frame; do not add, remove or change anything. ${pos} hands are empty. ` +
    // Konuşma tarifi 2026-10-25'teki sorunsuz sürümle aynı: "slowly and clearly" çıkarılıp "upbeat and excited"
    // eklenince model hızlandı ve kelime uydurdu ("dairegilde", "yür yüz"). Canlılık metnin kendisinden gelir.
    `Audio: ${pr.toLowerCase()} speaks slowly and clearly in natural standard Turkish (İstanbul accent), ${p.voice}, studio-quality clean voice recording, ` +
    `saying exactly: "${line}" Pronounce every Turkish letter correctly, including the dotless ı. Quiet ambience only, no music, no other voices.`
  );
}
