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

export const DEFAULT_PRICING: PricingSettings = {
  creditPriceTry: 100,
  usdTry: 42,
  higgsfieldCreditUsd: 0.05,
  credits: { "arsa-drone": 1, "ilan-videosu": 1, "bitmis-hali": 2, "insaat-videosu": 2, "dosenmis-ev": 1 },
  costUsd: {
    "arsa-drone": 0.15,
    "ilan-videosu": { perPhoto: 0.06 },
    "bitmis-hali": 0.35,
    "insaat-videosu": 0.9,
    "dosenmis-ev": { perRoom: 0.12, base: 0.05 },
    // 2026-10-26: 10 sn'lik sahne orta ~16,5, yüksek ~36,5 plan kredisi (apps/worker/src/templates/sunucu-ev.ts).
    "sunucu-ev": { higgsfieldPerScene: { orta: 16.5, yuksek: 36.5 }, extraUsdPerScene: 0.02 },
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
