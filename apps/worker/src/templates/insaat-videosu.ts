/**
 * Arsadan inşaat videosu: arsanın ~40° yukarıdan çekimi ve drone yaklaşma çekimi (RunPod drone worker, Cesium, aynı anda)
 * → Higgsfield ile netleştirme → kazıdan bitmiş yapıya ~20 sn timelapse (insaat-hat.ts, Higgsfield) → yaklaşma başa eklenir
 * → emlakçı kapanış kartı → inşaat sesleri, imar bilgisini okuyan seslendirme, veri kartları ve müzik (insaat-ses.ts).
 */
import { existsSync } from "node:fs";
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

  // 1) Yan kare ve drone yaklaşma çekimi: RunPod drone worker'ında Cesium ile (sunucuda GPU ve Chrome yok). İkisi aynı
  // anda gönderilir; panelde "Drone çekimi" aşaması geçilmeden çekim biter, inşaat ondan sonra başlar. Yeniden denemede
  // (ara dosyalar durur) hazır olan tekrar çizilmez.
  await ctx.stage("parcel");
  await ctx.stage("side");
  const drone = new RunpodClient(env.RUNPOD_API_KEY, env.RUNPOD_DRONE_ENDPOINT_ID);
  const fetchOut = async (r: { url?: string; key?: string; base64?: string }, file: string) => {
    if (r.base64) await writeFile(file, Buffer.from(r.base64, "base64"));
    else await download(r.url ?? (await ctx.r2.url(r.key!, 3600)), file);
    return file;
  };
  const side = name("yan.png");
  // still/approach true: worker eski sürümde `if inp.get("still")` diye bakıyor, boş nesne Python'da yanlış sayılıp tam drone turu
  // çiziliyordu (2026-11-01: 335 sn, 654 kare, yan kare yok).
  const sideJob = existsSync(side)
    ? Promise.resolve(side)
    : runJob(drone, { parcel: v.parcelText, still: true, output_prefix: `reels/${v.id}/side` }, "yan kare", ctx.log).then((o) => {
        const r = o.still as { url?: string; key?: string; base64?: string } | undefined;
        if (!r) throw new Error("Drone worker yan kare döndürmedi (worker sürümü güncel değil olabilir)");
        return fetchOut(r, side);
      });
  // Gelmezse video yaklaşmasız çıkar. limit_frames: approach'u tanımayan eski worker tam tur yerine tek kare çizsin.
  const approachFile = name("yaklasma.mp4");
  const approachJob = (
    existsSync(approachFile)
      ? Promise.resolve(approachFile)
      : runJob(drone, { parcel: v.parcelText, approach: true, limit_frames: 1, output_prefix: `reels/${v.id}/approach` }, "yaklaşma", ctx.log).then((o) => {
          const r = o.video as { url?: string; key?: string; base64?: string } | undefined;
          if (!r || o.timings?.approach === undefined) throw new Error("Drone worker yaklaşma çekimi döndürmedi (worker sürümü güncel değil olabilir)");
          return fetchOut(r, approachFile);
        })
  ).catch((e) => (ctx.log(`! yaklaşma çekimi yok: ${String(e).slice(0, 200)}`), null));

  // Cesium karosu yakında bulanık: aynı kadrajda fotogerçekçi drone fotoğrafına.
  const start = await editImage(gen, await stripAttribution(await sideJob, name("yan-kirpik.png")), ENHANCE_PROMPT, name("yan-net.png"), "netleştirme", SEED);
  await ctx.preview?.(start, "Arsa");

  await ctx.stage("approach");
  const raw = await approachJob;
  if (raw) await ctx.preview?.(raw, "Drone çekimi");

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
    onPreview: ctx.preview,
  });

  // Kurgu: drone yaklaşma çekimi başa eklenir; inşaat, ses ve kartlar o kadar kayar. Bozuksa video yaklaşmasız çıkar.
  let construction = final;
  let offset = 0;
  if (raw) {
    const r = await prependApproach(raw, final, name("yaklasmali.mp4")).catch((e) => {
      ctx.log(`! yaklaşma çekimi eklenemedi: ${String(e).slice(0, 200)}`);
      return null;
    });
    if (r) ({ video: construction, offset } = r);
  }
  await ctx.stage("compose", 0.5);

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
