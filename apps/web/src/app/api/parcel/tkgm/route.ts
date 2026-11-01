import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { hookText } from "@/lib/hook";
import { mergeParcelTexts, summarizeParcel } from "@/lib/parcel";
import { tkgmList, tkgmParcel } from "@/lib/tkgm";

/** Sihirbaz 1. adım, TKGM sorgusu: ?tip=il | ilce&id=<ilId> | mahalle&id=<ilceId> seçenek listesi döner. */
export async function GET(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const url = new URL(req.url);
  const tip = url.searchParams.get("tip");
  const id = Number(url.searchParams.get("id"));
  if (tip !== "il" && tip !== "ilce" && tip !== "mahalle") return badRequest("Liste türü geçersiz");
  if (tip !== "il" && !(Number.isInteger(id) && id > 0)) return badRequest("Üst birim seçilmedi");
  try {
    return NextResponse.json({ items: await tkgmList(tip, id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

type ParcelQuery = { mahalleId?: number; ada?: string; parsel?: string };

/**
 * Mahalle + ada + parsel ile parseli TKGM'den çeker; dosya yüklemeyle aynı yanıtı (özet, çokgenler, ses cümlesi) ve dosya metnini döner.
 * parcels verilirse (yan yana / parçalı arsa, en fazla 10) hepsi sırayla çekilir ve tek dosyada birleşir.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as ParcelQuery & { parcels?: ParcelQuery[] };
  const queries = Array.isArray(body.parcels) ? body.parcels : [body];
  if (!queries.length) return badRequest("Parsel seçin");
  if (queries.length > 10) return badRequest("Bir videoda en fazla 10 parsel olabilir");
  const texts: string[] = [];
  for (const q of queries) {
    const a = String(q.ada ?? "").trim();
    const p = String(q.parsel ?? "").trim();
    if (!Number.isInteger(q.mahalleId) || q.mahalleId! <= 0) return badRequest("Mahalle seçin");
    if (!/^\d{1,7}$/.test(a)) return badRequest("Ada numarası yalnızca rakam olmalı");
    if (!/^\d{1,7}$/.test(p)) return badRequest("Parsel numarası yalnızca rakam olmalı");
    try {
      texts.push(await tkgmParcel(q.mahalleId!, a, p));
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    const text = mergeParcelTexts(texts);
    const parsed = summarizeParcel(text);
    const m = parsed.summary.mahalle?.split(",")[0] ?? "parsel";
    const nos = queries.map((q) => `${String(q.ada).trim()}-${String(q.parsel).trim()}`).join("_");
    return NextResponse.json({ fileName: `TKGM ${m} ${nos}.geojson`, text, summary: parsed.summary, rings: parsed.rings, hook: hookText(parsed) });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}
