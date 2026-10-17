/**
 * Çevre noktası adayları: Google Places (yerler, ilçe/köy merkezi) + yükseklik verisinden denize uzaklık.
 * Panel kullanıcıya bu listeyi gösterir, kullanıcı seçer; seçim yoksa pickDefaultPois videoya girecekleri seçer.
 */
import type { LatLng } from "./kml.js";
import { googleNearbyPois, googleSettlements } from "./google.js";
import { poiCategoryInfo, type Poi } from "./pois.js";
import { seaDistance } from "./sea.js";

export interface PoiCandidates {
  pois: Poi[];
  /** Kaynaklardan biri çalışmadıysa nedeni (panelde uyarı olarak gösterilir). */
  warnings: string[];
}

/** Yavaş kaynak tüm listeyi bekletmesin: süre dolunca hata sayılır. */
function deadline<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} ${ms / 1000} sn içinde yanıt vermedi`)), ms))]);
}

export async function poiCandidates(
  origin: LatLng,
  opts: { googleKey?: string; district?: string; province?: string; neighbourhood?: string } = {},
): Promise<PoiCandidates> {
  const warnings: string[] = [];
  const key = opts.googleKey;
  const noKey = Promise.reject(new Error("Google anahtarı yok"));
  noKey.catch(() => {});
  const [places, towns, sea] = await Promise.allSettled([
    key ? googleNearbyPois(origin, key) : noKey,
    key ? googleSettlements(origin, key, opts) : noKey,
    deadline(seaDistance(origin, key), 25_000, "Yükseklik verisi"),
  ]);
  // Kullanıcıya kısa açıklama; ayrıntı sunucu günlüğüne.
  if (places.status === "rejected" || towns.status === "rejected") {
    const reason = String(places.status === "rejected" ? places.reason : (towns as PromiseRejectedResult).reason);
    console.warn("[çevre] Google Places:", reason.slice(0, 400));
    warnings.push(
      !key || /403|PERMISSION_DENIED|blocked/i.test(reason)
        ? "Google yer araması kapalı (API anahtarında Places API (New) açılmalı); öneriler eksik."
        : "Google yer araması şu an yanıt vermedi; öneriler eksik.",
    );
  }
  if (sea.status === "rejected") {
    console.warn("[çevre] deniz:", String(sea.reason).slice(0, 400));
    warnings.push("Denize uzaklık ölçülemedi; deniz yakınsa haritada kıyıya tıklayıp “Deniz” olarak ekleyin.");
  }

  const all = [
    ...(sea.status === "fulfilled" && sea.value ? [sea.value] : []),
    ...(towns.status === "fulfilled" ? towns.value : []),
    ...(places.status === "fulfilled" ? places.value : []),
  ];
  // Aynı yer birden çok aramada çıkarsa bir kez (aynı kategori, aynı ad, 2 km içinde).
  const norm = (n?: string) => (n ?? "").toLocaleLowerCase("tr").trim();
  const seen: Poi[] = [];
  for (const p of all) {
    const dup = seen.some((q) => q.category === p.category && norm(q.name) === norm(p.name) && Math.abs(q.distanceM - p.distanceM) < 2000);
    if (!dup) seen.push(p);
  }
  seen.sort((a, b) => poiCategoryInfo(a.category).priority - poiCategoryInfo(b.category).priority || a.distanceM - b.distanceM);
  return { pois: seen, warnings };
}

/** Videoya otomatik girecekler: her kategoriden en yakını (ilçe merkezi adıyla arandığı için ilk gelen), önem sırasıyla. */
export function pickDefaultPois(cands: Poi[], limit = 5): Poi[] {
  const best = new Map<string, Poi>();
  for (const p of cands) {
    const prev = best.get(p.category);
    if (!prev || (p.category !== "town" && p.distanceM < prev.distanceM)) best.set(p.category, p);
  }
  // Deniz varsa plaj tekrarı gereksiz.
  if (best.has("sea")) best.delete("beach");
  return [...best.values()]
    .sort((a, b) => poiCategoryInfo(a.category).priority - poiCategoryInfo(b.category).priority || a.distanceM - b.distanceM)
    .slice(0, limit);
}
