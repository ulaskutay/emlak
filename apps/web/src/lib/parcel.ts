import "server-only";
import type { ParcelSummary } from "@arsa/db";
import { analyzeParcel, mergeParcelFiles, officialAreaM2, parseParcelFile } from "@arsa/geo";

/**
 * Yüklenen TKGM dosyasını ayrıştırır: özet + önizleme için parsel çokgenleri. Geçersizse anlaşılır hata.
 * Dosyada birden çok parsel olabilir (yan yana / parçalı arsa): alan toplanır, ada/parsel birleşir.
 */
export function summarizeParcel(text: string) {
  let parsed;
  try {
    parsed = parseParcelFile(text);
  } catch (e) {
    throw new Error(`Parsel dosyası okunamadı: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (parsed.ring.length < 3) throw new Error("Dosyada parsel sınırı (en az 3 köşe) bulunamadı");
  const geo = analyzeParcel(parsed.rings);
  const p = parsed.properties;
  const summary: ParcelSummary = {
    areaM2: officialAreaM2(p) ?? geo.areaM2,
    ada: p.Ada,
    parsel: p.ParselNo,
    nitelik: p.Nitelik,
    il: p.Il,
    ilce: p.Ilce,
    mahalle: p.Mahalle,
    centroid: geo.centroid,
  };
  return { summary, rings: parsed.rings, properties: p, geo };
}

/** Birden çok parsel dosyasını (TKGM sorguları ya da yüklenen dosyalar) tek GeoJSON metninde birleştirir. */
export function mergeParcelTexts(texts: string[]): string {
  if (texts.length === 1) return texts[0]!;
  try {
    return mergeParcelFiles(texts);
  } catch (e) {
    throw new Error(`Parsel dosyası okunamadı: ${e instanceof Error ? e.message : String(e)}`);
  }
}
