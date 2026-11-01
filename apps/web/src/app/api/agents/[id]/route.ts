import { agents, and, eq, getDb } from "@arsa/db";
import { SavedAgentInput } from "@arsa/shared";
import { NextResponse } from "next/server";
import { apiUser, badRequest, notFound, unauthorized } from "@/lib/api";
import { agentView, ownAssets } from "@/lib/agents";

type Params = { params: Promise<{ id: string }> };

/** Emlakçıyı günceller (tüm alanlar; boş bırakılan görsel kaldırılır). */
export async function PUT(req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = SavedAgentInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  const a = parsed.data;
  if (!ownAssets(user.id, a)) return badRequest("Geçersiz görsel");
  const [row] = await getDb()
    .update(agents)
    .set({ name: a.name, officeName: a.officeName ?? null, phone: a.phone ?? null, photoKey: a.photoKey ?? null, logoKey: a.logoKey ?? null })
    .where(and(eq(agents.id, (await params).id), eq(agents.userId, user.id)))
    .returning();
  if (!row) return notFound();
  return NextResponse.json({ agent: await agentView(row) });
}

/** Emlakçıyı siler; daha önce üretilen videolar etkilenmez (sipariş anındaki bilgiyle basıldılar). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const rows = await getDb()
    .delete(agents)
    .where(and(eq(agents.id, (await params).id), eq(agents.userId, user.id)))
    .returning({ id: agents.id });
  if (!rows.length) return notFound();
  return NextResponse.json({ ok: true });
}
