import "server-only";
import type { Agent } from "@arsa/db";
import { r2 } from "@/lib/r2";

/** Panele giden emlakçı: görsellerin imzalı önizleme linkleriyle. */
export async function agentView(a: Agent) {
  const asset = async (key: string | null) => (key ? { key, url: await r2().url(key, 3600) } : undefined);
  return { id: a.id, name: a.name, officeName: a.officeName ?? "", phone: a.phone ?? "", photo: await asset(a.photoKey), logo: await asset(a.logoKey) };
}
export type AgentView = Awaited<ReturnType<typeof agentView>>;

/** Görseller yalnızca kullanıcının kendi yüklemeleri olabilir. */
export const ownAssets = (userId: string, a: { photoKey?: string; logoKey?: string }) =>
  [a.photoKey, a.logoKey].every((k) => !k || k.startsWith(`uploads/${userId}/`));
