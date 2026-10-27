import { TOUR_QUALITY, type TemplateId, type TemplateInput, type TourQuality } from "./templates.js";

/**
 * Kredi ve maliyet: siparişte düşülen kullanıcı kredisi ve yönetici panelindeki tahmini maliyet.
 * Değerler yönetici panelinden (/admin/ayarlar) değiştirilir; buradakiler ilk değerlerdir.
 */
export interface PricingSettings {
  /** Bir kredinin satış fiyatı (TL): paket fiyatı yokken gelir tahmininde kullanılır. */
  creditPriceTry: number;
  /** Dolar kuru: maliyetler dolar girilir, panelde TL gösterilir. */
  usdTry: number;
  /** Higgsfield plan kredisinin dolar değeri (plan ücreti / plan kredisi). */
  higgsfieldCreditUsd: number;
  /** Şablon başına kullanıcı kredisi (sunucuda sahne başına, kaliteye göre TOUR_QUALITY). */
  credits: Record<Exclude<TemplateId, "sunucu-ev">, number>;
  /** Şablon başına tahmini maliyet ($): RunPod GPU, ElevenLabs, Google; sahne/oda başına olanlar ayrıca. */
  costUsd: {
    "arsa-drone": number;
    "ilan-videosu": { perPhoto: number };
    "bitmis-hali": number;
    "insaat-videosu": number;
    "dosenmis-ev": { perRoom: number; base: number };
    /** Sahne başına Higgsfield kredisi (kalite) + sahne başına RunPod/ElevenLabs ($). */
    "sunucu-ev": { higgsfieldPerScene: Record<TourQuality, number>; extraUsdPerScene: number };
  };
}

/**
 * 2026-10-27 hesabı. Birim fiyatlar:
 * - RunPod faturası: RTX PRO 6000 (Qwen, Wan, Hunyuan) $0,00097/sn, drone (RTX 4090) $0,00031/sn; işçi soğuk açılışı
 *   (model yükleme) ~120 sn, tek tük siparişte her videoda ödenir. Qwen düzenleme ~40 sn, Wan 81 kare 4 adım ~90 sn.
 * - ElevenLabs eleven_v3 ~$0,00022/karakter (Creator); müzik uzunluğa göre önbellekte. Google Places aylık ücretsiz kotada.
 * - Higgsfield (hesap hareketleri): Seedream 5.0 Pro 2,5 kredi/kare, Gemini Omni Flash 1.1 360p 1, 720p 3 kredi/sn,
 *   ByteDance büyütme 1080p 60 FPS ~0,4 kredi/sn. Plus aylık $49/1000 kredi; ek paketler biraz pahalı → $0,05.
 */
export const DEFAULT_PRICING: PricingSettings = {
  creditPriceTry: 100,
  usdTry: 49.79,
  higgsfieldCreditUsd: 0.05,
  credits: { "arsa-drone": 1, "ilan-videosu": 1, "bitmis-hali": 2, "insaat-videosu": 2, "dosenmis-ev": 1 },
  costUsd: {
    // Drone render ~265 sn $0,08 + seslendirme ~450 karakter $0,10 + Google.
    "arsa-drone": 0.2,
    // Hunyuan sahnesi ~60 sn + soğuk açılış payı.
    "ilan-videosu": { perPhoto: 0.1 },
    // Drone render $0,08 + Qwen (soğuk) ~160 sn $0,16 + Wan (soğuk) ~270 sn $0,26.
    "bitmis-hali": 0.5,
    // Qwen 3 kare + Wan 5 klip ~930 sn $0,90 + yan kare $0,02 + seslendirme ve inşaat sesleri ~$0,16.
    "insaat-videosu": 1.1,
    // Oda başına Qwen + Wan ~130 sn; sabit: 3 soğuk açılış $0,35 + seslendirme $0,07.
    "dosenmis-ev": { perRoom: 0.13, base: 0.42 },
    // 10 sn'lik sahne: kare 2,5 + klip (orta 360p 10, yüksek 720p 30) + büyütme 4 kredi. Ek: Scribe, döşenirse Qwen payı.
    "sunucu-ev": { higgsfieldPerScene: { orta: 16.5, yuksek: 36.5 }, extraUsdPerScene: 0.03 },
  },
};

/** Kayıtlı ayarı varsayılanlarla tamamlar (yeni alan eklenince eski kayıt bozulmasın). */
export function mergePricing(saved: unknown): PricingSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<PricingSettings>;
  const d = DEFAULT_PRICING;
  return {
    ...d,
    ...s,
    credits: { ...d.credits, ...s.credits },
    costUsd: {
      ...d.costUsd,
      ...s.costUsd,
      "ilan-videosu": { ...d.costUsd["ilan-videosu"], ...s.costUsd?.["ilan-videosu"] },
      "dosenmis-ev": { ...d.costUsd["dosenmis-ev"], ...s.costUsd?.["dosenmis-ev"] },
      "sunucu-ev": {
        ...d.costUsd["sunucu-ev"],
        ...s.costUsd?.["sunucu-ev"],
        higgsfieldPerScene: { ...d.costUsd["sunucu-ev"].higgsfieldPerScene, ...s.costUsd?.["sunucu-ev"]?.higgsfieldPerScene },
      },
    },
  };
}

const photoCount = (input: TemplateInput) => ("photos" in input && Array.isArray(input.photos) ? input.photos.length : 0);
const tourQuality = (input: TemplateInput): TourQuality => ("quality" in input && input.quality ? input.quality : "orta");

/** Siparişte düşülecek kredi. */
export function videoCredits(template: TemplateId, input: TemplateInput, p: PricingSettings = DEFAULT_PRICING): number {
  if (template === "sunucu-ev") return photoCount(input) * TOUR_QUALITY[tourQuality(input)].credits;
  return p.credits[template];
}

/** Tahmini maliyet (TL). */
export function estimateCostTry(template: TemplateId, input: TemplateInput, p: PricingSettings): number {
  const c = p.costUsd;
  const n = photoCount(input);
  let usd: number;
  switch (template) {
    case "ilan-videosu":
      usd = c[template].perPhoto * n;
      break;
    case "dosenmis-ev":
      usd = c[template].base + c[template].perRoom * n;
      break;
    case "sunucu-ev":
      usd = n * (c[template].higgsfieldPerScene[tourQuality(input)] * p.higgsfieldCreditUsd + c[template].extraUsdPerScene);
      break;
    default:
      usd = c[template];
  }
  return usd * p.usdTry;
}
