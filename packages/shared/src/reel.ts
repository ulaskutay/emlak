import { z } from "zod";

/**
 * Arsa Reels siparişi: panel formu, API ve kuyruk worker'ı aynı şemayı kullanır.
 * Parsel dosyası (TKGM GeoJSON/KML) ayrıca metin olarak gelir.
 */
export const ReelListing = z.object({
  /** Satış fiyatı (TL). Kapanış kartında ve seslendirmede kullanılır. */
  priceTry: z.coerce.number().positive().max(10_000_000_000).optional(),
  /** İmar durumu, ör. "Konut imarlı, E:0.30" ya da "Tarla, imarsız". */
  zoning: z.string().trim().max(80).optional(),
  officeName: z.string().trim().max(60).optional(),
  /** Görünür telefon: kapanış kartında yazılır, seslendirmede okunmaz. */
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+ ()-]{7,20}$/, "Telefon yalnızca rakam, boşluk, + ve parantez içerebilir")
    .optional(),
});
export type ReelListing = z.infer<typeof ReelListing>;

export const ReelOrder = z.object({
  parcelFileName: z.string().trim().min(1).max(200),
  parcelText: z.string().min(20).max(2_000_000),
  listing: ReelListing.default({}),
  voiceId: z.string().trim().min(5).max(64).optional(),
  music: z.boolean().default(true),
});
export type ReelOrder = z.infer<typeof ReelOrder>;

/** Üretim aşamaları: panelde aşama çizgisi bu sırayla gösterilir. */
export const REEL_STAGES = [
  { id: "parcel", label: "Parsel ve çevre" },
  { id: "script", label: "Senaryo" },
  { id: "voice", label: "Seslendirme" },
  { id: "render", label: "Drone render" },
  { id: "mix", label: "Ses miksi" },
  { id: "done", label: "Hazır" },
] as const;
export type ReelStage = (typeof REEL_STAGES)[number]["id"];

export type ReelStatus = "queued" | "running" | "done" | "failed";
