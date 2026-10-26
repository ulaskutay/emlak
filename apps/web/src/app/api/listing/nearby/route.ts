import { geocodePlace, googleNearbyPois, type LatLng } from "@arsa/geo";
import type { TourNearby } from "@arsa/shared";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";

/** Anlatımda söylenmeye değer yerler, önem sırasıyla; her biri en fazla bu uzaklıkta (m). */
const WORTH: [string, number][] = [
  ["metro", 2500],
  ["beach", 3000],
  ["mall", 8000],
  ["school", 1500],
  ["park", 1200],
  ["hospital", 8000],
  ["university", 8000],
];

/**
 * Sunuculu ev turu: ilanın konumuna (ilan sayfasındaki harita koordinatı ya da "Mahalle, İlçe, İl" araması)
 * en yakın anlamlı yerler. Form senaryonun konum cümlesini bundan kurar.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const { location, province, lat, lng } = (await req.json().catch(() => ({}))) as { location?: string; province?: string; lat?: number; lng?: number };
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ nearby: [] });
  let origin: LatLng | null = typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  if (!origin) {
    if (!location?.trim()) return badRequest("Konum yok");
    // "Üsküdar Acıbadem" → "Acıbadem, Üsküdar, İstanbul"
    const [district, ...hood] = location.trim().split(/\s+/);
    origin = await geocodePlace([hood.join(" "), district, province].filter(Boolean).join(", "), key);
    if (!origin) return NextResponse.json({ nearby: [] });
  }
  const pois = await googleNearbyPois(origin, key, 1).catch(() => []);
  const nearby: TourNearby[] = WORTH.flatMap(([cat, max]) => {
    const p = pois.find((x) => x.category === cat && x.distanceM <= max);
    return p ? [{ category: cat, name: p.name, distanceM: Math.round(p.distanceM) }] : [];
  });
  return NextResponse.json({ origin, nearby: nearby.slice(0, 3) });
}
