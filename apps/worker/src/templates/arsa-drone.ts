/** Arsa drone turu: parsel → senaryo → seslendirme → drone render → miks (drone-studio hattı). */
import { contextKey, eq, getDb, parcelContexts } from "@arsa/db";
import { produceReel } from "@arsa/drone-studio/pipeline";
import type { ParcelContext } from "@arsa/geo";
import type { JobContext, JobResult } from "./common.js";

export async function arsaDrone(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  if (!v.parcelText || !v.parcelSummary) throw new Error("Parsel dosyası eksik");
  const db = getDb();
  const ckey = contextKey(v.parcelSummary.centroid);
  const [cached] = await db.select().from(parcelContexts).where(eq(parcelContexts.key, ckey));
  const r = await produceReel({
    parcelText: v.parcelText,
    context: (cached?.context as ParcelContext | undefined) ?? null,
    listing: v.listing,
    voiceId: v.voiceId ?? undefined,
    music: v.music,
    render: "runpod",
    workDir: ctx.workDir,
    cacheDir: ctx.cacheDir,
    outputPrefix: `reels/${v.id}/render`,
    log: ctx.log,
    onStage: (s, p) => ctx.stage(s, p),
  });
  if (!cached && r.context.pois.length) await db.insert(parcelContexts).values({ key: ckey, context: r.context }).onConflictDoNothing();
  // Kapak: kancanın göründüğü an (m² kartı ve parsel çizgisi).
  return { videoPath: r.reelPath, durationSec: r.durationSec, posterAt: 2.4, stats: { seconds: r.seconds, renderer: r.renderer, keyframes: r.keyframes } };
}
