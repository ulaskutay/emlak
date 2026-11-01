import { randomUUID } from "node:crypto";
import { agents, asc, count, eq, getDb } from "@arsa/db";
import { SavedAgentInput } from "@arsa/shared";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { agentView, ownAssets } from "@/lib/agents";

/** Bir hesapta en fazla bu kadar emlakçı (ofis kadrosu için yeterli). */
const MAX_AGENTS = 30;

/** Kullanıcının kayıtlı emlakçıları (eskiden yeniye). */
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const rows = await getDb().select().from(agents).where(eq(agents.userId, user.id)).orderBy(asc(agents.createdAt));
  return NextResponse.json({ agents: await Promise.all(rows.map(agentView)) });
}

/** Yeni emlakçı. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = SavedAgentInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  const a = parsed.data;
  if (!ownAssets(user.id, a)) return badRequest("Geçersiz görsel");
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(agents).where(eq(agents.userId, user.id));
  if (n >= MAX_AGENTS) return badRequest(`En fazla ${MAX_AGENTS} emlakçı eklenebilir`);
  const [row] = await db
    .insert(agents)
    .values({ id: randomUUID(), userId: user.id, name: a.name, officeName: a.officeName ?? null, phone: a.phone ?? null, photoKey: a.photoKey ?? null, logoKey: a.logoKey ?? null })
    .returning();
  return NextResponse.json({ agent: await agentView(row!) }, { status: 201 });
}
