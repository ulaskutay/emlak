import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { hookText } from "@/lib/hook";
import { mergeParcelTexts, summarizeParcel } from "@/lib/parcel";

/**
 * Sihirbaz 1. adım: yüklenen TKGM dosyasını (ya da birden çok parselin dosyalarını, texts) doğrular;
 * özet + önizleme çokgenleri + ses örneği cümlesi ve birleşik dosya metnini döner.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { text?: string; texts?: string[] };
  const texts = Array.isArray(body.texts) ? body.texts.filter((t) => typeof t === "string" && t) : body.text ? [body.text] : [];
  if (!texts.length || texts.length > 20 || texts.reduce((n, t) => n + t.length, 0) > 2_000_000) return badRequest("Dosya boş ya da çok büyük");
  try {
    const text = mergeParcelTexts(texts);
    const p = summarizeParcel(text);
    return NextResponse.json({ text, summary: p.summary, rings: p.rings, hook: hookText(p) });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}
