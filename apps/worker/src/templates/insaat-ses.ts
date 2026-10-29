/**
 * İnşaat videosunun sesi: şantiye sesi + imar bilgisini okuyan seslendirme + hafif fon müziği.
 *
 * Şantiye sesi aşama aşama Higgsfield Mirelo efektleriyle kurulur (kazı → beton/vinç → çekiç/matkap → bitmiş site),
 * her biri videodaki aşamanın saniyesinde; ses yükseklikleri eşitlenir, aralarda yumuşak geçiş. 2026-10-29'a kadar
 * ElevenLabs'in genel efektleriydi, "çok kötü" bulundu; Kling'in kendi sesi de istemde yasaklansa müzik çıkıyor.
 * Seslendirme tek seferde okutulup cümlelere kesilir (common.ts speakLines), tonlama baştan sona tek akış.
 *
 * Videonun 4 dilimi (~5 sn) ile eşlenir: kazı → kaba yapı → cephe → peyzaj. Her dilime bir efekt ve bir cümle düşer;
 * cümle uzarsa sonrakiler kayar. Rakamlar seslendirmeye yazıyla gider (ElevenLabs ondalıkları bozabiliyor).
 * Üretilen sesler parsel klasöründe metin özetiyle önbelleğe alınır.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ElevenLabsClient, HiggsfieldCli } from "@arsa/providers";
import { locative, numberWords, spokenPrice } from "@arsa/shared";
import { download, speakLines } from "./common.js";

const run = promisify(execFile);
// Sitenin yazı tipleri (agent-card ile aynı): kartlar ve uyarı yazısı.
const font = (f: string) => fileURLToPath(new URL(`../../fonts/${f}.ttf`, import.meta.url));
const DISPLAY = font("BricolageGrotesque-ExtraBold");
const SANS_SEMI = font("InstrumentSans-SemiBold");
// Kart alt satırı: Instrument Sans'ta "²" yok (m² kutu çıkıyordu), Bricolage'da var.
const CARD_SMALL = font("BricolageGrotesque-Bold");

export interface Zoning {
  /** İmar türü, ör. "Konut", "Ticari", "Turizm". */
  use: string;
  /** Emsal (KAKS), ör. 1.20. */
  emsal: number;
  /** TAKS, ör. 0.30. */
  taks?: number;
  /** İzin verilen kat sayısı. */
  floors?: number;
}

export interface ScriptInput {
  place?: string;
  areaM2: number;
  zoning: Zoning;
  priceTry?: number;
  /** Emlakçı kapanış kartının başladığı saniye: fiyat ve çağrı oraya taşınır (fiyat kartta yazar). */
  outroAt?: number;
  /**
   * İnşaatın videoda başladığı saniye (başta drone yaklaşma çekimi varsa). Arsayı tanıtan ilk cümle ve kartı
   * yaklaşma sırasında söylenir; inşaat aşamalarına bağlı cümleler ve efektler bu kadar kayar.
   */
  offset?: number;
}

/** 1.2 → "bir virgül yirmi", 0.3 → "sıfır virgül otuz" (iki basamak: emsal böyle söylenir). */
export function spokenRatio(x: number) {
  const [whole, frac] = x.toFixed(2).split(".") as [string, string];
  return `${numberWords(Number(whole))} virgül ${frac === "00" ? "sıfır" : numberWords(Number(frac))}`;
}

/** Ekrandaki veri kartı: büyük satır (değer) ve küçük satır (açıklama). */
export interface Card {
  big: string;
  small: string;
}

const fmt = (n: number, digits = 0) => n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Dört dilimin cümleleri, hedef başlangıç saniyeleri ve ekran kartları (videonun aşamalarıyla eşleşir).
 * Kart, cümlenin rakamla yazılmış hali: sessiz izleyen de bilgiyi alır.
 */
export function constructionScript(i: ScriptInput): { at: number; text: string; card?: Card }[] {
  const z = i.zoning;
  // Yaklaşma varsa ilk cümle onun sırasında söylenir; ikinci cümle inşaatın başında (offset + 0,4), sonrakiler
  // aynı aralıkla: yoksa kazı aşaması sessiz kalıyordu.
  const o = i.offset ? i.offset - 4.8 : 0;
  const area = numberWords(Math.round(i.areaM2));
  const buildableM2 = Math.round((i.areaM2 * z.emsal) / 10) * 10;
  const use = z.use.toLocaleLowerCase("tr");
  const lines: { at: number; text: string; card?: Card }[] = [
    {
      at: 0.4,
      text: `${i.place ? `${locative(i.place)} ` : ""}${area} metrekare, ${use} imarlı arsa.`,
      card: { big: `${fmt(i.areaM2)} m²`, small: [`${z.use} imarlı`, i.place].filter(Boolean).join(" · ") },
    },
    {
      at: o + 5.2,
      text: `Emsal ${spokenRatio(z.emsal)}. Tam ${numberWords(buildableM2)} metrekare inşaat alanı.`,
      card: { big: `Emsal ${fmt(z.emsal, 2)}`, small: `${fmt(buildableM2)} m² inşaat alanı` },
    },
  ];
  const third = [
    z.taks ? `Taban alanı yüzde ${numberWords(Math.round(z.taks * 100))}` : "",
    z.floors ? `${numberWords(z.floors)} kata kadar yapılaşma` : "",
  ].filter(Boolean);
  if (third.length)
    lines.push({
      at: o + 10.4,
      text: `${third.join(", ")}.`,
      card: z.taks
        ? { big: `TAKS ${fmt(z.taks, 2)}`, small: z.floors ? `${z.floors} kata kadar yapılaşma` : `${fmt(i.areaM2 * z.taks)} m² taban alanı` }
        : { big: `${z.floors} kat`, small: "kata kadar yapılaşma" },
    });
  const price = i.priceTry ? `Fiyatı ${spokenPrice(i.priceTry)} lira.` : "";
  if (i.outroAt !== undefined) {
    lines.push({ at: o + 15.4, text: "Projeniz bu arsada yükselsin." });
    lines.push({ at: i.outroAt + 0.3, text: [price, "Detaylı bilgi için hemen arayın."].filter(Boolean).join(" ") });
  } else
    lines.push({
      at: o + 15.4,
      text: [price, "Projeniz bu arsada yükselsin."].filter(Boolean).join(" "),
      card: i.priceTry ? { big: `${fmt(i.priceTry)} TL`, small: "Satılık arsa" } : undefined,
    });
  return lines;
}

/**
 * Aşama efektleri (Mirelo), videodaki sırayla ve her biri bir dilim: kazı, kaba yapı, ince işler, bitmiş site.
 * Uzaktan kayıt gibi tarif edilir: drone yüksekten bakıyor, yakın ve sert sesler kulağı rahatsız ediyordu.
 */
const SFX_MODEL = "mirelo_text_to_audio";
const SFX = [
  "Construction site recorded from a distance: two excavators digging soil with diesel engines rumbling, buckets scraping earth, a dump truck unloading dirt and rocks. Realistic field recording, no music, no voices.",
  "Construction site recorded from a distance: a concrete mixer truck pouring concrete, a tower crane motor humming, steel rebar clanking, steady hammering. Realistic field recording, no music, no voices.",
  "Construction site recorded from a distance: hammering on scaffolding, short power drill bursts, a brick saw, a crane reversing beep far away. Realistic field recording, no music, no voices.",
  "A quiet, newly finished residential neighbourhood on a sunny day: birds chirping, a soft breeze in the trees, a car arriving slowly in the distance. Realistic field recording, no music, no voices.",
];
/** Yaklaşma çekiminin sesi (inşaattan önce, yukarıdan iniş). */
const AERIAL_SFX =
  "Gentle wind high above the countryside, soft air rushing past, faint birds far below. Realistic field recording, no music, no voices.";
/** Efektler arası çapraz geçiş (sn). */
const SFX_FADE = 1.5;
const MUSIC =
  "Light modern real estate background music, soft piano and warm pads with a gentle steady pulse, optimistic and calm, " +
  "slowly building to a confident resolved ending. No vocals, no drops, no risers.";

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);
const probe = async (f: string) =>
  Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout.trim());

/** Videoya ses ekler; seslendirme metnini ve zamanlarını döndürür. */
export async function addConstructionAudio(o: {
  video: string;
  out: string;
  cacheDir: string;
  script: ScriptInput;
  /** Dilim süresi (sn). */
  segment: number;
  music?: boolean;
  voiceId?: string | null;
  log?: (m: string) => void;
}) {
  const log = o.log ?? console.log;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY eksik");
  const el = new ElevenLabsClient({ apiKey: key, voiceId: o.voiceId || process.env.ELEVENLABS_VOICE_ID, model: process.env.ELEVENLABS_MODEL });
  const D = await probe(o.video);
  const voiceId = await el.resolveVoice();

  // Seslendirme: tek seferde okunur, cümleler sırayla ve üst üste binmeden yerleşir (uzayan cümle sonrakini kaydırır).
  const lines = constructionScript(o.script);
  const spoken = await speakLines(lines.map((l) => l.text), voiceId, { cacheDir: o.cacheDir, log });
  if (!spoken) throw new Error("Seslendirme üretilemedi");
  const cues: { at: number; file: string; text: string; dur: number; card?: Card }[] = [];
  let free = 0;
  for (const [k, l] of lines.entries()) {
    const { file, duration: dur } = spoken[k]!;
    const at = Math.max(l.at, free);
    cues.push({ at, file, text: l.text, dur, card: l.card });
    free = at + dur + 0.25;
  }
  // Geri: son cümle videonun sonuna sığacak kadar öne çekilir, öncekiler de ona göre (döşeme şablonundaki gibi).
  let limit = D - 0.3;
  for (let k = cues.length - 1; k >= 0; k--) {
    cues[k]!.at = Math.min(cues[k]!.at, limit - cues[k]!.dur);
    limit = cues[k]!.at - 0.25;
  }
  if (cues[0]!.at < 0) log(`! seslendirme videoya sığmıyor (${(-cues[0]!.at).toFixed(1)} sn taşıyor)`);

  // Şantiye sesi: aşama başına bir efekt; son efekt (bitmiş site) kapanışa kadar sürer. Komşularla çapraz geçiş payı.
  const hf = new HiggsfieldCli();
  const offset = o.script.offset ?? 0;
  const prompts = offset > 0 ? [AERIAL_SFX, ...SFX] : SFX;
  const starts = offset > 0 ? [0, ...SFX.map((_, k) => offset + k * o.segment)] : SFX.map((_, k) => k * o.segment);
  const lens = prompts.map((_, k) =>
    k < prompts.length - 1 ? starts[k + 1]! - starts[k]! + SFX_FADE : Math.max(o.segment, D - starts[k]!) + 0.5,
  );
  const sfx = await Promise.all(
    prompts.map(async (prompt, k) => {
      const seconds = Math.ceil(lens[k]!);
      const file = join(o.cacheDir, `efekt-${hash(`${SFX_MODEL}|${prompt}|${seconds}`)}.audio`);
      if (!existsSync(file)) {
        const r = await hf.generate(SFX_MODEL, { params: { prompt, duration: seconds } }, { label: `efekt ${k + 1}`, log });
        await download(r.url, file);
      }
      return file;
    }),
  );
  let music: string | null = null;
  if (o.music !== false) {
    const file = join(o.cacheDir, `muzik-${hash(`${MUSIC}|${Math.ceil(D)}`)}.mp3`);
    if (!existsSync(file)) await el.music(MUSIC, Math.ceil(D)).then((b) => writeFile(file, b)).catch((e) => log(`! müzik üretilemedi: ${String(e).slice(0, 160)}`));
    if (existsSync(file)) music = file;
  }

  // Miks: seslendirme önde; efektler ve müzik konuşma sırasında kısılır (ducking).
  const inputs = ["-i", o.video];
  const f: string[] = [];
  let idx = 1;
  const vl = cues.map((c, k) => {
    inputs.push("-i", c.file);
    const ms = Math.round(c.at * 1000);
    f.push(`[${idx++}:a]adelay=${ms}|${ms},aresample=44100[v${k}]`);
    return `[v${k}]`;
  });
  f.push(`${vl.join("")}amix=inputs=${vl.length}:normalize=0,volume=1.2,apad,atrim=0:${D.toFixed(2)},asplit=3[voice][sc1][sc2]`);
  // Her efekt aynı ses yüksekliğine getirilir (loudnorm), aşamanın başlangıcından yarım geçiş önce girer.
  const sl = sfx.map((file, k) => {
    inputs.push("-i", file);
    const start = Math.max(0, starts[k]! - SFX_FADE / 2);
    const ms = Math.round(start * 1000);
    const len = lens[k]!;
    f.push(
      `[${idx++}:a]aresample=44100,aformat=channel_layouts=stereo,loudnorm=I=-24:TP=-3:LRA=9,aresample=44100,atrim=0:${len.toFixed(2)},` +
        `afade=t=in:d=${k ? SFX_FADE : 0.4},afade=t=out:st=${(len - SFX_FADE).toFixed(2)}:d=${SFX_FADE},adelay=${ms}|${ms}[e${k}]`,
    );
    return `[e${k}]`;
  });
  f.push(`${sl.join("")}amix=inputs=${sl.length}:normalize=0,volume=0.9,apad,atrim=0:${D.toFixed(2)}[sfx]`);
  f.push(`[sfx][sc1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[sfxd]`);
  const buses = ["[voice]", "[sfxd]"];
  if (music) {
    inputs.push("-i", music);
    f.push(`[${idx++}:a]aresample=44100,atrim=0:${D.toFixed(2)},afade=t=in:d=0.8,afade=t=out:st=${(D - 1.5).toFixed(2)}:d=1.5,volume=0.22[mus]`);
    f.push(`[mus][sc2]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=450[musd]`);
    buses.push("[musd]");
  } else f.push(`[sc2]anullsink`);
  f.push(`${buses.join("")}amix=inputs=${buses.length}:normalize=0,alimiter=limit=0.95[aout]`);
  // Temsili görsel uyarısı (yapay zekâ üretimi bina gerçek proje değil).
  const W = 1080;
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");
  // Yaklaşma çekimi gerçek harita görüntüsü: uyarı inşaatla başlar.
  const noteUntil = o.script.outroAt ?? D;
  const note = `drawtext=fontfile='${SANS_SEMI}':text='Görüntü temsilidir':fontsize=${Math.round(W * 0.028)}:fontcolor=white@0.85:borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=h*0.955:enable='between(t,${offset.toFixed(2)},${noteUntil.toFixed(2)})'`;
  f.push(`[0:v]${note}[v0]`);
  // Veri kartları: üstte gökyüzü bölgesinde; cümleyle girer, sonraki cümleye kadar kalır (son kart videonun sonuna kadar).
  const CW = 900, CH = 230, CX = 90, CY = 190, FADE = 0.35;
  let vLabel = "[v0]";
  const shown = cues.filter((c) => c.card);
  shown.forEach((c, k) => {
    const next = cues[cues.indexOf(c) + 1];
    const until = Math.min(o.script.outroAt ?? D, next ? next.at - 0.15 : D);
    const dur = Math.max(0.8, until - c.at);
    f.push(
      `color=c=black@0.0:s=${CW}x${CH}:r=30:d=${dur.toFixed(2)},format=rgba,` +
        `drawbox=x=0:y=0:w=${CW}:h=${CH}:color=black@0.5:t=fill:replace=1,` +
        `drawbox=x=0:y=0:w=14:h=${CH}:color=0xFFC24D@1:t=fill:replace=1,` +
        `drawtext=fontfile='${DISPLAY}':text='${esc(c.card!.big)}':fontsize=88:fontcolor=white:x=56:y=38,` +
        `drawtext=fontfile='${CARD_SMALL}':text='${esc(c.card!.small)}':fontsize=42:fontcolor=white@0.9:x=58:y=150,` +
        `fade=t=in:st=0:d=${FADE}:alpha=1,fade=t=out:st=${(dur - FADE).toFixed(2)}:d=${FADE}:alpha=1,` +
        `setpts=PTS+${c.at.toFixed(2)}/TB[card${k}]`,
    );
    f.push(`${vLabel}[card${k}]overlay=x=${CX}:y=${CY}:eof_action=pass[vc${k}]`);
    vLabel = `[vc${k}]`;
  });
  f.push(`${vLabel}fade=t=out:st=${(D - 0.6).toFixed(2)}:d=0.6[vout]`);
  await run("ffmpeg", [
    "-v", "error", "-y", ...inputs, "-filter_complex", f.join(";"), "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-t", D.toFixed(2), o.out,
  ]);
  return cues;
}

export async function readParcelInfo(dir: string) {
  const p = JSON.parse(await readFile(join(dir, "parcel.json"), "utf8")) as {
    areaM2: number;
    properties: Record<string, string>;
    address?: { district?: string; neighbourhood?: string };
  };
  const hood = (p.properties.Mahalle ?? p.address?.neighbourhood)?.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, "");
  const district = p.properties.Ilce ?? p.address?.district;
  return { areaM2: p.areaM2, place: [district, hood].filter(Boolean).join(" ") || undefined };
}
