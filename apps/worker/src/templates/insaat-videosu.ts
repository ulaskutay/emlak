/**
 * Arsadan inşaat videosu: arsanın yandan yakın çekimi (RunPod drone worker, Cesium) → Higgsfield ile netleştirme →
 * kazıdan bitmiş yapıya ~20 sn timelapse (insaat-hat.ts, Higgsfield); başta drone yaklaşma çekimi (aynı worker, paralel)
 * → emlakçı kapanış kartı → inşaat sesleri, imar bilgisini okuyan seslendirme, veri kartları ve müzik (insaat-ses.ts).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HiggsfieldCli, RunpodClient } from "@arsa/providers";
import type { BuildingType, DosemeOrder, Zoning } from "@arsa/shared";
import { download, priceText, type JobContext, type JobResult } from "./common.js";
import { appendOutro, buildConstruction, editImage, ENHANCE_PROMPT, OUTRO_SECONDS, prependApproach, runJob, SEGMENT_SECONDS, stripAttribution, type Gen } from "./insaat-hat.js";
import { addConstructionAudio } from "./insaat-ses.js";

/** Dilim sayısı: 4 × 5 sn = 20 sn inşaat. */
const CLIPS = 4;
const SEED = 10;

export async function insaatVideosu(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  if (!v.parcelText || !v.parcelSummary) throw new Error("Parsel dosyası eksik");
  const { building, floors = 4, zoning, agent } = v.input as { building?: BuildingType; floors?: number; zoning?: Zoning; agent?: DosemeOrder["agent"] };
  if (!building) throw new Error("Yapı tipi eksik");
  if (!zoning) throw new Error("İmar bilgisi eksik");

  const env = process.env;
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_DRONE_ENDPOINT_ID) throw new Error("RUNPOD_API_KEY / RUNPOD_DRONE_ENDPOINT_ID eksik");
  const gen: Gen = { hf: new HiggsfieldCli(), log: ctx.log };
  const name = (x: string) => join(ctx.workDir, `insaat-${x}`);

  // 1) Yan kare: RunPod drone worker'ında Cesium ile tek kare (sunucuda GPU ve Chrome yok).
  await ctx.stage("parcel");
  await ctx.stage("side");
  const drone = new RunpodClient(env.RUNPOD_API_KEY, env.RUNPOD_DRONE_ENDPOINT_ID);
  const out = await runJob(drone, { parcel: v.parcelText, still: {}, output_prefix: `reels/${v.id}/side` }, "yan kare", ctx.log);
  const still = out.still as { url?: string; key?: string; base64?: string } | undefined;
  if (!still) throw new Error("Drone worker yan kare döndürmedi (worker sürümü güncel değil olabilir)");
  // Drone yaklaşma çekimi ayrı bir RunPod işinde, inşaat üretilirken paralel çizilir. Yan kareden sonra gönderilir ki
  // uç noktada tek GPU varsa inşaatı geciktirmesin. Gelmezse video yaklaşmasız çıkar.
  // limit_frames: approach'u tanımayan eski worker sürümü tam drone turu yerine tek kare çizsin (yeni sürüm yok sayar).
  const approach = runJob(drone, { parcel: v.parcelText, approach: {}, limit_frames: 1, output_prefix: `reels/${v.id}/approach` }, "yaklaşma", ctx.log)
    .then(async (o) => {
      const r = o.video as { url?: string; key?: string; base64?: string } | undefined;
      if (!r || o.timings?.approach === undefined) throw new Error("Drone worker yaklaşma çekimi döndürmedi (worker sürümü güncel değil olabilir)");
      const file = name("yaklasma.mp4");
      if (r.base64) await writeFile(file, Buffer.from(r.base64, "base64"));
      else await download(r.url ?? (await ctx.r2.url(r.key!, 3600)), file);
      return file;
    })
    .catch((e) => (ctx.log(`! yaklaşma çekimi yok: ${String(e).slice(0, 200)}`), null));
  const side = name("yan.png");
  if (still.base64) await writeFile(side, Buffer.from(still.base64, "base64"));
  else await download(still.url ?? (await ctx.r2.url(still.key!, 3600)), side);
  // Cesium karosu yakında bulanık: aynı kadrajda fotogerçekçi drone fotoğrafına.
  const start = await editImage(gen, await stripAttribution(side, name("yan-kirpik.png")), ENHANCE_PROMPT, name("yan-net.png"), "netleştirme", SEED);

  // 2) İnşaat timelapse'i
  const final = await buildConstruction({
    gen,
    start,
    type: building,
    floors,
    clips: CLIPS,
    seed: SEED,
    name,
    onStage: (s, p) => ctx.stage(s, p),
  });

  // Drone yaklaşma çekimi başa eklenir; inşaat, ses ve kartlar o kadar kayar. Gelmezse ya da bozuksa video yaklaşmasız çıkar.
  await ctx.stage("approach");
  const raw = await approach;
  let construction = final;
  let offset = 0;
  if (raw) {
    const r = await prependApproach(gen, raw, final, name("yaklasmali.mp4")).catch((e) => {
      ctx.log(`! yaklaşma çekimi eklenemedi: ${String(e).slice(0, 200)}`);
      return null;
    });
    if (r) ({ video: construction, offset } = r);
  }

  // 3) Emlakçı kapanış kartı (döşeme şablonundaki kart; fotoğraf ve logo kullanıcının yüklemeleri)
  const fetchAsset = (key: string | undefined, file: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, file))).catch(() => null) : Promise.resolve(null);
  const { video, outroAt } = await appendOutro(construction, name("kapanis.mp4"), ctx.workDir, {
    price: priceText(v.listing.priceTry),
    rent: false,
    name: agent?.name,
    office: v.listing.officeName,
    phone: v.listing.phone,
    photo: await fetchAsset(agent?.photoKey, "emlakci.jpg"),
    logo: await fetchAsset(agent?.logoKey, "logo.png"),
  });

  // 4) Ses ve veri kartları
  await ctx.stage("sound");
  const s = v.parcelSummary;
  const hood = s.mahalle?.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, "");
  const cues = await addConstructionAudio({
    video,
    out: name("sesli.mp4"),
    cacheDir: ctx.cacheDir,
    segment: SEGMENT_SECONDS,
    music: v.music,
    voiceId: v.voiceId,
    log: ctx.log,
    script: {
      place: [s.ilce, hood].filter(Boolean).join(" ") || undefined,
      areaM2: s.areaM2,
      priceTry: v.listing.priceTry,
      outroAt,
      offset,
      zoning: { use: zoning.use, emsal: zoning.emsal, taks: zoning.taks, floors },
    },
  });
  const duration = outroAt + OUTRO_SECONDS;
  return {
    videoPath: name("sesli.mp4"),
    durationSec: duration,
    posterAt: Math.max(0, outroAt - 0.8),
    stats: { building, floors, zoning, lines: cues.map((c) => c.text) },
  };
}
