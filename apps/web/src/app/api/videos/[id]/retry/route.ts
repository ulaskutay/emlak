import { and, eq, getDb, videos } from "@arsa/db";
import { NextResponse } from "next/server";
import { apiUser, badRequest, notFound, unauthorized } from "@/lib/api";
import { enqueueReel } from "@/lib/queue";

/** Başarısız videoyu yeniden kuyruğa al. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const db = getDb();
  const [v] = await db.select({ status: videos.status }).from(videos).where(and(eq(videos.id, id), eq(videos.userId, user.id)));
  if (!v) return notFound();
  if (v.status !== "failed") return badRequest("Yalnızca başarısız videolar yeniden denenebilir");
  await db.update(videos).set({ status: "queued", stage: null, progress: 0, error: null }).where(eq(videos.id, id));
  await enqueueReel(id);
  return NextResponse.json({ ok: true });
}
