import { randomUUID } from "node:crypto";
import { desc, eq, getDb, videos } from "@arsa/db";
import { TEMPLATES, TemplateOrder } from "@arsa/shared";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { summarizeParcel } from "@/lib/parcel";
import { enqueueReel } from "@/lib/queue";

/** Kullanıcının videoları (yeniden eskiye). */
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const rows = await getDb()
    .select({
      id: videos.id,
      template: videos.template,
      status: videos.status,
      stage: videos.stage,
      progress: videos.progress,
      parcelSummary: videos.parcelSummary,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(eq(videos.userId, user.id))
    .orderBy(desc(videos.createdAt))
    .limit(100);
  return NextResponse.json({ videos: rows });
}

/** Yeni video siparişi: şablona göre doğrula, kaydet, kuyruğa at. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = TemplateOrder.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  const order = parsed.data;
  if (TEMPLATES[order.template].hidden) return badRequest("Bu şablon henüz sipariş almıyor");
  const id = randomUUID();
  const base = { id, userId: user.id, template: order.template, listing: order.listing, music: order.music };

  if (order.template === "ilan-videosu") {
    // Fotoğraflar yalnızca kullanıcının kendi yüklemeleri olabilir.
    if (order.photos.some((p) => !p.key.startsWith(`uploads/${user.id}/`))) return badRequest("Geçersiz fotoğraf");
    await getDb().insert(videos).values({ ...base, input: { photos: order.photos } });
  } else if (order.template === "dosenmis-ev") {
    const own = (k?: string) => !k || k.startsWith(`uploads/${user.id}/`);
    if (order.photos.some((p) => !own(p.key)) || !own(order.agent.photoKey) || !own(order.agent.logoKey)) return badRequest("Geçersiz fotoğraf");
    await getDb().insert(videos).values({ ...base, input: { photos: order.photos, style: order.style, details: order.details, agent: order.agent, voice: order.voice }, voiceId: order.voiceId ?? null });
  } else if (order.template === "sunucu-ev") {
    const own = (k?: string) => !k || k.startsWith(`uploads/${user.id}/`);
    if (order.photos.some((p) => !own(p.key)) || !own(order.agent.photoKey) || !own(order.agent.logoKey)) return badRequest("Geçersiz fotoğraf");
    await getDb().insert(videos).values({ ...base, input: { photos: order.photos, style: order.style, details: order.details, agent: order.agent, presenter: order.presenter } });
  } else {
    let summary;
    try {
      summary = summarizeParcel(order.parcelText).summary;
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : String(e));
    }
    const parcel = { parcelFileName: order.parcelFileName, parcelText: order.parcelText, parcelSummary: summary };
    if (order.template === "bitmis-hali")
      await getDb().insert(videos).values({ ...base, ...parcel, input: { building: order.building, floors: order.floors } });
    else if (order.template === "insaat-videosu") {
      const own = (k?: string) => !k || k.startsWith(`uploads/${user.id}/`);
      if (!own(order.agent.photoKey) || !own(order.agent.logoKey)) return badRequest("Geçersiz görsel");
      await getDb()
        .insert(videos)
        .values({ ...base, ...parcel, input: { building: order.building, floors: order.floors, zoning: order.zoning, agent: order.agent }, voiceId: order.voiceId ?? null });
    }
    else await getDb().insert(videos).values({ ...base, ...parcel, voiceId: order.voiceId ?? null });
  }
  await enqueueReel(id);
  return NextResponse.json({ id }, { status: 201 });
}
