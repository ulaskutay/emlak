import { z } from "zod";

/** Çıktı formatları: Reels/TikTok, YouTube/web, ilan sitesi. */
export const OutputFormat = z.enum(["reels_9x16", "youtube_16x9", "listing_16x9"]);
export type OutputFormat = z.infer<typeof OutputFormat>;

export const FORMAT_SPECS: Record<OutputFormat, { width: number; height: number; maxSeconds: number }> = {
  reels_9x16: { width: 1080, height: 1920, maxSeconds: 30 },
  youtube_16x9: { width: 1920, height: 1080, maxSeconds: 60 },
  listing_16x9: { width: 1280, height: 720, maxSeconds: 20 },
};

/** Render kalitesi: önizleme hızlı/düşük çözünürlük, final yüksek kalite. */
export const RenderQuality = z.enum(["preview", "final"]);
export type RenderQuality = z.infer<typeof RenderQuality>;

const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** İlan verisi: fotoğraf, konum/parsel ve (opsiyonel) ilan linkinden normalize edilir. */
export const Listing = z.object({
  title: z.string().min(1),
  listingType: z.enum(["arsa", "tarla", "villa_arsasi", "konut", "isyeri"]).default("arsa"),
  priceTry: z.number().positive().optional(),
  areaM2: z.number().positive().optional(),
  city: z.string(),
  district: z.string(),
  neighborhood: z.string().optional(),
  ada: z.string().optional(),
  parsel: z.string().optional(),
  zoning: z.string().optional(), // imar durumu, ör. "Konut, E:0.30"
  features: z.array(z.string()).default([]), // "Deniz manzaralı", "Yola cepheli"...
  center: LatLng.optional(),
  parcelPolygon: z.array(LatLng).min(3).optional(),
  photoUrls: z.array(z.string().url()).default([]),
  sourceUrl: z.string().url().optional(),
});
export type Listing = z.infer<typeof Listing>;

/**
 * Kamera hareketi. AI sahneleri yalnızca kamera hareketiyle sınırlı tutulur:
 * arsaya olmayan bina/yol eklenmesini (yanıltıcı reklam) engellemek için.
 */
export const CameraMove = z.enum([
  "slow_push_in",
  "slow_pull_out",
  "orbit_left",
  "orbit_right",
  "drone_rise",
  "pan_left",
  "pan_right",
]);
export type CameraMove = z.infer<typeof CameraMove>;

const SceneBase = z.object({
  id: z.string(),
  durationSec: z.number().min(1).max(10),
  voiceover: z.string().optional(), // TTS ile seslendirilecek Türkçe metin
});

export const Scene = z.discriminatedUnion("type", [
  /** GPU sahnesi: ilan fotoğrafını hareketlendirir (RunPod LTX / Seedance). */
  SceneBase.extend({
    type: z.literal("ai_photo_motion"),
    photoUrl: z.string().url(),
    camera: CameraMove,
    prompt: z.string(), // sahne açıklaması (ışık, atmosfer) — yapı eklememeli
  }),
  /** Uydu haritası + parsel sınırı animasyonu (CPU / Remotion). */
  SceneBase.extend({ type: z.literal("map_parcel") }),
  /** Fiyat, m², imar bilgi kartı (CPU / Remotion). */
  SceneBase.extend({
    type: z.literal("info_card"),
    headline: z.string(),
    lines: z.array(z.string()).max(4),
  }),
  /** Özellik listesi (CPU / Remotion). */
  SceneBase.extend({ type: z.literal("feature_list"), items: z.array(z.string()).min(1).max(6) }),
  /** Kapanış: logo, telefon, CTA (CPU / Remotion). */
  SceneBase.extend({ type: z.literal("outro_cta"), cta: z.string() }),
]);
export type Scene = z.infer<typeof Scene>;
export type AiScene = Extract<Scene, { type: "ai_photo_motion" }>;

export const Storyboard = z.object({
  format: OutputFormat,
  musicTrackId: z.string().optional(),
  scenes: z.array(Scene).min(1),
});
export type Storyboard = z.infer<typeof Storyboard>;

export const isAiScene = (s: Scene): s is AiScene => s.type === "ai_photo_motion";

export function storyboardDuration(sb: Storyboard): number {
  return sb.scenes.reduce((t, s) => t + s.durationSec, 0);
}
