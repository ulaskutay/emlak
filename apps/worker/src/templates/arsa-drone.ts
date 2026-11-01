/** Arsa drone turu: parsel → senaryo → seslendirme → drone render → miks (drone-studio hattı). */
import { contextKey, eq, getDb, parcelContexts } from "@arsa/db";
import { produceReel } from "@arsa/drone-studio/pipeline";
import type { ParcelContext } from "@arsa/geo";
import type { OrderAgent } from "@arsa/shared";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { download, ffmpeg, priceText, probeDuration, type JobContext, type JobResult } from "./common.js";
import { appendOutro } from "./insaat-hat.js";

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
  // Emlakçı seçildiyse drone kapanışından sonra fotoğraflı emlakçı kartı (diğer şablonlardaki kart).
  const agent = (v.input as { agent?: OrderAgent }).agent;
  const videoPath = agent && (agent.name || agent.photoKey || agent.logoKey) ? await withAgentCard(ctx, r.reelPath, agent) : r.reelPath;
  // Kapak: kancanın göründüğü an (m² kartı ve parsel çizgisi).
  return { videoPath, durationSec: await probeDuration(videoPath), posterAt: 2.4, stats: { seconds: r.seconds, renderer: r.renderer, keyframes: r.keyframes } };
}

/** Reel'in sonuna emlakçı kartı: görüntü eklenir, ses (müzik) kartın başında yumuşakça kısılıp sessizlikle uzar. */
async function withAgentCard(ctx: JobContext, reel: string, agent: OrderAgent) {
  const v = ctx.video;
  const fetchAsset = (key: string | undefined, name: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, name))).catch(() => null) : Promise.resolve(null);
  const { video, outroAt } = await appendOutro(reel, join(ctx.workDir, "reel-kart-sessiz.mp4"), ctx.workDir, {
    price: priceText(v.listing.priceTry),
    rent: false,
    name: agent.name,
    office: v.listing.officeName,
    phone: v.listing.phone,
    photo: await fetchAsset(agent.photoKey, "emlakci.jpg"),
    logo: await fetchAsset(agent.logoKey, "logo.png"),
  }, 1.5); // reel sonda siyaha kararır: arka plan biraz önceki kareden
  if (!(await hasAudio(reel))) return video;
  const total = await probeDuration(video);
  const out = join(ctx.workDir, "reel-kart.mp4");
  await ffmpeg([
    "-i", video, "-i", reel,
    "-filter_complex", `[1:a]afade=t=out:st=${Math.max(0, outroAt - 0.6).toFixed(3)}:d=0.6,apad,atrim=0:${total.toFixed(3)}[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out,
  ]);
  return out;
}

async function hasAudio(file: string) {
  const { stdout } = await promisify(execFile)("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file]);
  return stdout.trim().length > 0;
}
