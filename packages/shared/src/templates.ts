import { z } from "zod";
import { REEL_STAGES, ReelListing, ReelOrder } from "./reel.js";

/**
 * Video şablonları: galeri, sipariş formu, API ve worker aynı tanımı kullanır.
 * Yeni şablon = buraya tanım + sipariş şeması + apps/worker/src/templates altında üretim hattı.
 */
export const TEMPLATE_IDS = ["arsa-drone", "ilan-videosu", "bitmis-hali"] as const;
export const TemplateId = z.enum(TEMPLATE_IDS);
export type TemplateId = z.infer<typeof TemplateId>;

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  /** Galeri kartındaki tek cümle. */
  tagline: string;
  description: string;
  category: "Arsa" | "Konut" | "Proje";
  /** Kullanıcının hazırlaması gerekenler. */
  needs: string[];
  /** Videoda neler var. */
  includes: string[];
  duration: string;
  /** Örnek video ve kapak (public/ altında). Video yoksa yalnız kapak gösterilir. */
  preview: { video?: string; poster: string };
  badge?: "Yeni";
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
};

export const templateList = TEMPLATE_IDS.map((id) => TEMPLATES[id]);

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

/** API'nin kabul ettiği sipariş. Şablonsuz eski istek arsa drone turu sayılır. */
export const TemplateOrder = z.preprocess(
  (v) => (v && typeof v === "object" && !("template" in v) ? { ...v, template: "arsa-drone" } : v),
  z.discriminatedUnion("template", [ArsaDroneOrder, IlanOrder, BitmisOrder]),
);
export type TemplateOrder = z.infer<typeof TemplateOrder>;

/** Şablona özgü, satırda saklanan girdi (parsel ve ilan bilgisi ayrı sütunlarda). */
export type TemplateInput =
  | { photos: IlanPhoto[] }
  | { building: BuildingType; floors: number }
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
