import { analyzeParcel, parseParcelFile, prepareParcel, type ParcelContext } from "@arsa/geo";
import { contextKey, eq, getDb, parcelContexts } from "@arsa/db";

/**
 * Drone yaklaşma çekimi (inşaat videosu) için parsel verisi: geometri, rakım, adres, yakın yerler, mahalle sınırı.
 * Çekim kullanıcının tarayıcısında çizilir (apps/drone-studio, /studio/index.html?record=1). Yavaş çevre sorguları
 * parcel_contexts'te önbelleğe alınır (arsa drone turu ile ortak).
 */
export async function approachParcel(text: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Harita anahtarı tanımlı değil");
  const ckey = contextKey(analyzeParcel(parseParcelFile(text).ring).centroid);
  const db = getDb();
  const [cached] = await db.select().from(parcelContexts).where(eq(parcelContexts.key, ckey));
  const parcel = await prepareParcel(text, {
    googleKey: process.env.GOOGLE_ELEVATION_API_KEY || key,
    placesKey: process.env.GOOGLE_PLACES_API_KEY || key,
    cached: (cached?.context as ParcelContext | undefined) ?? null,
  });
  if (!cached && parcel.pois.length) {
    const { elevation, elevationSource, address, pois, hood } = parcel;
    await db.insert(parcelContexts).values({ key: ckey, context: { elevation, elevationSource, address, pois, hood } }).onConflictDoNothing();
  }
  // Anahtar tarayıcıya açıktır: Google Cloud'da alan adına (HTTP referrer) kısıtlı olmalı.
  return { parcel, key };
}
