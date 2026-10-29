import { analyzeParcel, parseParcelFile, prepareParcel, type ParcelContext } from "@arsa/geo";
import { contextKey, eq, getDb, parcelContexts } from "@arsa/db";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";

/**
 * İnşaat videosunun drone yaklaşma çekimi için parsel verisi (geometri, rakım, adres, yakın yerler, mahalle sınırı)
 * ve 3D harita anahtarı: çekim kullanıcının tarayıcısında çizilir (apps/drone-studio, /studio/?record=1).
 * Yavaş çevre sorguları parcel_contexts'te önbelleğe alınır (arsa drone turu ile ortak).
 * Anahtar tarayıcıya açıktır: Google Cloud'da alan adına (HTTP referrer) kısıtlı olmalı.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Harita anahtarı tanımlı değil" }, { status: 503 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length > 2_000_000) return badRequest("Dosya boş ya da çok büyük");
  try {
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
    return NextResponse.json({ parcel, key });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}
