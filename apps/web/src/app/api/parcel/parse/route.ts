import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { hookText } from "@/lib/hook";
import { summarizeParcel } from "@/lib/parcel";

/** Sihirbaz 1. adım: yüklenen TKGM dosyasını doğrular, özet + önizleme çokgeni + ses örneği cümlesi döner. */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length > 2_000_000) return badRequest("Dosya boş ya da çok büyük");
  try {
    const p = summarizeParcel(text);
    return NextResponse.json({ summary: p.summary, ring: p.ring, hook: hookText(p) });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}
