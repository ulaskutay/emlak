/**
 * Fotoğraftan ilan videosu (yapay zekâ videosu yok, sunucuda Remotion): her fotoğraf yavaş kamera hareketiyle akar,
 * sahneler geçiş efektleriyle bağlanır; ilk sahnede ilanın kimliği, sonrakilerde oda başlığı, sonda fiyat ve emlakçı kartı.
 * Ses: ilan bilgisinden kurulan Türkçe seslendirme (ElevenLabs) ve anlatımda kısılan müzik.
 *
 * Sahne süresi anlatıma uyar: cümle uzunsa sahne uzar (anlatım hızlandırılmaz, kesilmez).
 */
import { join } from "node:path";
import { ROOM_LABELS, stagingNarration, type DosemeOrder, type IlanPhoto, type ListingDetails, type RoomPhoto, type RoomType } from "@arsa/shared";
import sharp from "sharp";
import type { IlanVideoProps, Move, Transition } from "../../remotion/types.js";
import { backgroundMusic, download, priceText, speakLines, type JobContext, type JobResult } from "./common.js";
import { enhancePhoto } from "./enhance.js";
import { renderComposition } from "./remotion.js";

/** Sunucuda 60 FPS render edilir (yapay zekâ büyütmesi gerekmez; kaynak zaten 1080p). */
const FPS = 60;
/** Geçiş süresi (kare). */
const T = Math.round(0.8 * FPS);
const SCENE_SECONDS = 3.4;
/** İlk sahnede ilanın kimliği okunacak kadar. */
const FIRST_SECONDS = 4;
const OUTRO_SECONDS = 3.8;
/** Anlatım sahne tam göründükten sonra başlar, bitince sahne biraz daha kalır. */
const VOICE_LEAD = 0.15;
const VOICE_TAIL = 0.45;
const OUTRO_TAIL = 1.2;
/** Kadraj 1920 yükseklikte en fazla ~1,16 kat yakınlaşır: fotoğrafın 2400 piksel yüksekliği yeter. */
const PHOTO_FIT = { width: 4200, height: 2400 };

/**
 * Geçiş: yumuşak çözülme (2026-10-30: kayan/büyüyen/yükselen/iris geçişler ve whoosh sesi sert bulundu; kullanıcı
 * fade istedi). Kamera hareketi kesilmeden sürüyormuş gibi: yeni kare hafif büyükten ve bulanıktan netleşir.
 */
const TRANSITIONS: Transition[] = ["fade"];

const VIDEO_LABELS: Partial<Record<RoomType, string>> = { dis_cephe: "Dış cephe" };

/** Eski siparişler oda tipi yerine dış/iç mekân taşır: dış cephe tanınır, iç mekânın tipi bilinmez (anlatım kapalı). */
type Photo = Omit<RoomPhoto, "room"> & { room?: RoomType };
const normalize = (p: RoomPhoto | IlanPhoto): Photo =>
  "room" in p ? p : { key: p.key, title: p.title, focusX: 0.5, room: p.setting === "exterior" ? "dis_cephe" : undefined };

/** Fotoğraf sırasına göre hareket: yaklaş, sağa kaydır, uzaklaş, sola kaydır; dar fotoğrafta kaydırma yerine yaklaş/uzaklaş. */
function moveFor(i: number, w: number, h: number): Move {
  const wide = w / h / (9 / 16) > 1.5;
  const m = (["push", "panRight", "pull", "panLeft"] as const)[i % 4]!;
  if (wide || m === "push" || m === "pull") return m;
  return m === "panRight" ? "pull" : "push";
}


export async function ilanVideosu(ctx: JobContext): Promise<JobResult> {
  const v = ctx.video;
  const input = v.input as { photos?: (RoomPhoto | IlanPhoto)[]; details?: ListingDetails; agent?: DosemeOrder["agent"]; voice?: boolean };
  const photos = (input.photos ?? []).map(normalize);
  if (!photos.length) throw new Error("Fotoğraf yok");
  const details: Partial<ListingDetails> = input.details ?? {};
  const agent = input.agent ?? {};

  // Seslendirme ilk: fotoğraflar iyileştirilirken üretilir. İlk sahne ilanın kimliği, sonrakiler öne çıkanlar ve oda
  // cümleleri, kapanışta fiyat ve çağrı.
  const typed = photos.every((p) => p.room);
  const narration = typed ? stagingNarration(photos.map((p) => p.room!), details, v.listing.priceTry, { tour: true }) : null;
  const lines = narration ? [...narration.rooms, narration.outro] : [];
  const speech =
    input.voice === true && lines.length
      ? speakLines(lines, v.voiceId, ctx).catch((e) => (ctx.log(`! seslendirme üretilemedi: ${String(e).slice(0, 160)}`), null))
      : Promise.resolve(null);

  // 1) Fotoğraflar: Real-ESRGAN ile JPEG bozulması temizlenip büyütülür (sırayla; her biri bütün çekirdekleri kullanır).
  await ctx.stage("photos");
  const fetchAsset = (key: string | undefined, name: string) =>
    key ? ctx.r2.url(key, 600).then((u) => download(u, join(ctx.workDir, name))).catch(() => undefined) : Promise.resolve(undefined);
  const [raws, photo, logo] = await Promise.all([
    Promise.all(photos.map(async (p, i) => download(await ctx.r2.url(p.key, 3600), join(ctx.workDir, `ham-${i + 1}.jpg`)))),
    fetchAsset(agent.photoKey, "emlakci.jpg"),
    fetchAsset(agent.logoKey, "logo.png"),
  ]);
  const frames: { file: string; width: number; height: number; enhanced: boolean }[] = [];
  const t0 = Date.now();
  for (const [i, raw] of raws.entries()) {
    const file = join(ctx.workDir, `kare-${i + 1}.jpg`);
    const r = await enhancePhoto(raw, file, { fit: PHOTO_FIT, onProgress: (p) => void ctx.stage("photos", (i + p) / raws.length) }).catch(async (e) => {
      // Model açılamazsa video yine çıksın: fotoğraf yalnız döndürülüp küçültülür.
      ctx.log(`! fotoğraf ${i + 1} iyileştirilemedi: ${String(e).slice(0, 160)}`);
      const info = await sharp(raw).rotate().resize({ ...PHOTO_FIT, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(file);
      return { file, width: info.width, height: info.height, enhanced: false };
    });
    frames.push(r);
  }
  ctx.log(`fotoğraflar: ${frames.filter((f) => f.enhanced).length}/${frames.length} iyileştirildi, ${((Date.now() - t0) / 1000).toFixed(0)} sn`);

  // 2) Seslendirme
  await ctx.stage("voice");
  const voices = await speech;

  // 3) Zaman çizelgesi (kare): sahne anlatımına göre uzar.
  const sec = (s: number) => Math.round(s * FPS);
  const n = photos.length;
  let at = 0;
  const scenes = photos.map((p, i) => {
    const voice = voices?.[i]?.duration ?? 0;
    const frames = sec(Math.max(i === 0 ? FIRST_SECONDS : SCENE_SECONDS, voice ? VOICE_LEAD + voice + VOICE_TAIL : 0));
    const s = { from: at, frames };
    at += frames;
    return s;
  });
  const outroVoice = voices?.[n]?.duration ?? 0;
  const outro = { from: at, frames: sec(Math.max(OUTRO_SECONDS, outroVoice ? VOICE_LEAD + outroVoice + OUTRO_TAIL : 0)) };
  const total = outro.from + outro.frames;
  const music = v.music ? await backgroundMusic(total / FPS, ctx) : null;

  // 4) Render
  await ctx.stage("render", 0);
  const rent = /kiralık/i.test(details.kind ?? "");
  const facts = [details.rooms, details.netM2 && `${details.netM2} m²`].filter(Boolean) as string[];
  const out = join(ctx.workDir, "ilan.mp4");
  await renderComposition(
    "IlanVideo",
    [ctx.workDir, ctx.cacheDir],
    (url, fontBase): IlanVideoProps => ({
      fps: FPS,
      durationInFrames: total,
      transition: T,
      fontBase,
      scenes: photos.map((p, i) => ({
        src: url(frames[i]!.file),
        width: frames[i]!.width,
        height: frames[i]!.height,
        focusX: p.focusX,
        title: p.title?.trim() || (p.room ? (VIDEO_LABELS[p.room] ?? ROOM_LABELS[p.room]) : undefined),
        move: moveFor(i, frames[i]!.width, frames[i]!.height),
        transition: TRANSITIONS[(i - 1 + TRANSITIONS.length) % TRANSITIONS.length]!,
        ...scenes[i]!,
      })),
      intro: details.kind || details.location ? { kind: details.kind, location: details.location, facts } : undefined,
      outro: {
        ...outro,
        transition: "fade",
        background: url(frames[n - 1]!.file),
        price: priceText(v.listing.priceTry),
        priceLabel: rent ? "Aylık kira" : "Fiyat",
        name: agent.name,
        office: v.listing.officeName,
        phone: v.listing.phone,
        photo: photo && url(photo),
        logo: logo && url(logo),
      },
      audio: {
        music: music ? url(music) : undefined,
        voice: voices
          ? voices.map((vc, k) => ({
              src: url(vc.file),
              from: (k < n ? scenes[k]!.from : outro.from) + sec(VOICE_LEAD),
              frames: sec(vc.duration),
              words: vc.words.map((w) => ({ text: w.word, start: sec(w.start), end: sec(w.end) })),
            }))
          : [],
        whooshAt: [],
      },
    }),
    out,
    { log: ctx.log, onProgress: (p) => void ctx.stage("render", p) },
  );
  return {
    videoPath: out,
    durationSec: total / FPS,
    posterAt: 1.5,
    stats: { scenes: n, renderer: "remotion", enhanced: frames.filter((f) => f.enhanced).length, narration: lines, voiced: !!voices, music: !!music },
  };
}
