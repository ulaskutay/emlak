import "server-only";
import { desc, eq, getDb, videos } from "@arsa/db";
import { r2 } from "@/lib/r2";

/** Kullanıcının videoları, kapak linkleriyle (yeniden eskiye). */
export async function userVideos(userId: string, limit = 100) {
  const rows = await getDb()
    .select({
      id: videos.id,
      template: videos.template,
      input: videos.input,
      status: videos.status,
      stage: videos.stage,
      parcelSummary: videos.parcelSummary,
      keyframeKey: videos.keyframeKey,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(eq(videos.userId, userId))
    .orderBy(desc(videos.createdAt))
    .limit(limit);
  const posters = await Promise.all(rows.map((v) => (v.keyframeKey ? r2().url(v.keyframeKey, 6 * 3600) : null)));
  return rows.map((v, i) => ({ ...v, poster: posters[i] }));
}
export type UserVideo = Awaited<ReturnType<typeof userVideos>>[number];
