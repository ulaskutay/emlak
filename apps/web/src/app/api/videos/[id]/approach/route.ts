import { and, eq, getDb, videos } from "@arsa/db";
import { NextResponse } from "next/server";
import { apiUser, badRequest, notFound, unauthorized } from "@/lib/api";
import { approachParcel } from "@/lib/approach";

/**
 * İnşaat videosunun drone yaklaşma çekimi, üretim sırasında video sayfasında (ApproachRecorder):
 *   GET   parsel verisi ve harita anahtarı (çekimi tarayıcı çizer)
 *   POST  { progress } ilerleme (worker, sayfa açık ve çekim sürüyorsa inşaattan sonra bekler)
 *         { key }      bitmiş çekim (uploads/<kullanıcı>/….mp4)
 *         { failed }   çekim yapılamadı: worker beklemeden yaklaşmasız devam eder
 * Durum video satırının input.approach alanında, çekim input.approachKey'de durur.
 */
async function own(id: string) {
  const user = await apiUser();
  if (!user) return { error: unauthorized() };
  const [v] = await getDb()
    .select({ template: videos.template, status: videos.status, input: videos.input, parcelText: videos.parcelText })
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.userId, user.id)));
  if (!v || v.template !== "insaat-videosu") return { error: notFound() };
  return { user, v };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await own(id);
  if ("error" in r) return r.error;
  if (!r.v.parcelText) return badRequest("Parsel dosyası yok");
  try {
    return NextResponse.json(await approachParcel(r.v.parcelText));
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await own(id);
  if ("error" in r) return r.error;
  if (r.v.status !== "queued" && r.v.status !== "running") return badRequest("Video üretimde değil");
  const body = (await req.json().catch(() => ({}))) as { progress?: number; key?: string; failed?: string };
  const input = (r.v.input ?? {}) as Record<string, unknown>;
  let next: Record<string, unknown>;
  if (typeof body.key === "string") {
    if (!new RegExp(`^uploads/${r.user.id}/[\\w-]+\\.mp4$`).test(body.key)) return badRequest("Geçersiz çekim");
    next = { ...input, approachKey: body.key, approach: { progress: 1, at: Date.now() } };
  } else if (typeof body.failed === "string") {
    next = { ...input, approach: { failed: body.failed.slice(0, 300), at: Date.now() } };
  } else if (typeof body.progress === "number") {
    next = { ...input, approach: { progress: Math.max(0, Math.min(1, body.progress)), at: Date.now() } };
  } else return badRequest("Eksik bilgi");
  await getDb().update(videos).set({ input: next as typeof videos.$inferInsert.input }).where(eq(videos.id, id));
  return NextResponse.json({ ok: true });
}
