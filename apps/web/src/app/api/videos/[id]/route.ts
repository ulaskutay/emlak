import { and, eq, getDb, videos } from "@arsa/db";
import type { VideoPreview } from "@arsa/shared";
import { NextResponse } from "next/server";
import { apiUser, notFound, unauthorized } from "@/lib/api";
import { r2 } from "@/lib/r2";

/** Video durumu (panel 3 sn'de bir sorgular); hazırsa oynatma ve indirme linkleri. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const [v] = await getDb()
    .select()
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.userId, user.id)));
  if (!v) return notFound();
  const { parcelText: _omit, ...rest } = v;
  let urls: { play?: string; download?: string; poster?: string; previews?: { url: string; kind: VideoPreview["kind"]; label: string }[] } = {};
  if (v.status === "done" && v.reelKey) {
    const s = r2();
    const name = v.parcelSummary
      ? `${v.template}-${v.parcelSummary.ada ?? ""}-${v.parcelSummary.parsel ?? ""}.mp4`.replace(/[, ]+/g, "_").replace(/-+/g, "-").replace("-.mp4", ".mp4")
      : `${v.template}-${v.id.slice(0, 8)}.mp4`;
    urls = {
      play: await s.url(v.reelKey, 6 * 3600),
      download: await s.url(v.reelKey, 3600, name),
      poster: v.keyframeKey ? await s.url(v.keyframeKey, 6 * 3600) : undefined,
    };
  }
  // Üretim sürerken (ya da hata verdiyse) ara çıktılar: panelde sol tarafta önizleme.
  const previews = (v.stats as { previews?: VideoPreview[] } | null)?.previews;
  if (v.status !== "done" && previews?.length) {
    const s = r2();
    urls.previews = await Promise.all(previews.map(async (p) => ({ url: await s.url(p.key, 6 * 3600), kind: p.kind, label: p.label })));
  }
  return NextResponse.json({ video: rest, urls });
}
