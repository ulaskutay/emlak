import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { hookText } from "@/lib/hook";
import { summarizeParcel } from "@/lib/parcel";
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

/** Mahalle + ada + parsel ile parseli TKGM'den çeker; dosya yüklemeyle aynı yanıtı (özet, çokgen, ses cümlesi) ve dosya metnini döner. */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const { mahalleId, ada, parsel } = (await req.json().catch(() => ({}))) as { mahalleId?: number; ada?: string; parsel?: string };
  const a = String(ada ?? "").trim();
  const p = String(parsel ?? "").trim();
  if (!Number.isInteger(mahalleId) || mahalleId! <= 0) return badRequest("Mahalle seçin");
  if (!/^\d{1,7}$/.test(a)) return badRequest("Ada numarası yalnızca rakam olmalı");
  if (!/^\d{1,7}$/.test(p)) return badRequest("Parsel numarası yalnızca rakam olmalı");
  let text: string;
  try {
    text = await tkgmParcel(mahalleId!, a, p);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
  try {
    const parsed = summarizeParcel(text);
    const m = parsed.summary.mahalle ?? "parsel";
    return NextResponse.json({ fileName: `TKGM ${m} ${a}-${p}.geojson`, text, summary: parsed.summary, ring: parsed.ring, hook: hookText(parsed) });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}
