import { POI_CATEGORIES, poiCandidates, pickDefaultPois } from "@arsa/geo";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";

/**
 * Sihirbaz "Yakın noktalar" adımı: parselin çevresindeki aday noktalar (Google Places + yükseklik verisinden deniz)
 * ve otomatik önerilen seçim. Kullanıcı listeden seçer ya da haritada kendi noktasını ekler.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const { lat, lng, district, province, neighbourhood } = (await req.json().catch(() => ({}))) as {
    lat?: number;
    lng?: number;
    district?: string;
    province?: string;
    neighbourhood?: string;
  };
  if (typeof lat !== "number" || typeof lng !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180) return badRequest("Konum geçersiz");
  const placesKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const { pois, warnings } = await poiCandidates({ lat, lng }, { googleKey: placesKey, district, province, neighbourhood });
  // Önerilenler: her kategorinin en iyisi (en fazla 8); hiçbiri kendiliğinden seçilmez, kullanıcı seçer (videoda en fazla 4).
  return NextResponse.json({ pois, suggested: pickDefaultPois(pois, 8), categories: POI_CATEGORIES, warnings });
}
