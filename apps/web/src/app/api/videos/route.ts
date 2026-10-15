import { randomUUID } from "node:crypto";
import { desc, eq, getDb, videos } from "@arsa/db";
import { ReelOrder } from "@arsa/shared";
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

/** Yeni video siparişi: doğrula, kaydet, kuyruğa at. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = ReelOrder.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  const order = parsed.data;
  let summary;
  try {
    summary = summarizeParcel(order.parcelText).summary;
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
  const id = randomUUID();
  await getDb().insert(videos).values({
    id,
    userId: user.id,
    parcelFileName: order.parcelFileName,
    parcelText: order.parcelText,
    parcelSummary: summary,
    listing: order.listing,
    voiceId: order.voiceId ?? null,
    music: order.music,
  });
  await enqueueReel(id);
  return NextResponse.json({ id }, { status: 201 });
}
