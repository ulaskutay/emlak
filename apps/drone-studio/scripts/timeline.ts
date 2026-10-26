/**
 * Drone kurgusu (arsa odaklı): her karenin kamera ve görsel durumu.
 *
 *   1 Kanca     alçaktan, hızlı ve gerçekçi drone yaklaşması + yörünge; büyük başlık, neon kontur çizilir
 *   2 Bölge     kesme → yüksek plan: mahalle sınırı çizilir, parsele pin düşer, dalga halkaları, konum etiketi
 *   3 Tarama    aynı plan içinde parsele dalış, kuşbakışı tarama çizgisi + ızgara, m² sayacı taramayla sayar
 *   4 Özellik   kesme → alçak yörünge / kesme → vinç yükselişi; özellik kutucukları sırayla gelir
 *   5 Kapanış   kesme → kahraman plan, m² + konum, fiyat ve iletişim kartı
 *
 * Süreler seslendirmeye göre uzar (anlatım kesilmez). Çekimler arasında kesme + parlama + whoosh;
 * çekim içinde kamera hiç durmaz (uç hızlar sıfır değil, Hermite eğrisi).
 */
import type { FeatureChip, FrameState, ParcelInfo } from "../src/types.js";
import type { Story, StoryWord } from "./story.js";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** t'nin [a, b] aralığındaki ilerlemesi (0..1). */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Kamera anahtarı: heading sürekli sayı (360'a sarılmaz), range metre. */
type Key = { t: number; lat: number; lng: number; range: number; tilt: number; heading: number };
type Shot = { start: number; end: number; keys: Key[] };

/**
 * Çekim içi kamera: Hermite eğrisi, menzil log uzayında. Eğimler monoton (Fritsch–Carlson benzeri): yön değiştiren
 * anahtarda hız sıfır, aşma yok (kamera hedefin altına inip geri çıkmaz). Uçlarda hız sürer (kesmeye canlı girilir).
 */
function shotCamera(keys: Key[], t: number) {
  const ch = ["lat", "lng", "range", "tilt", "heading"] as const;
  const val = (k: Key, c: (typeof ch)[number]) => (c === "range" ? Math.log(k.range) : k[c]);
  let i = keys.findIndex((_, j) => j < keys.length - 1 && t <= keys[j + 1]!.t);
  if (i < 0) i = keys.length - 2;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const secant = (j: number, c: (typeof ch)[number]) => (val(keys[j + 1]!, c) - val(keys[j]!, c)) / (keys[j + 1]!.t - keys[j]!.t || 1);
  const slope = (j: number, c: (typeof ch)[number]) => {
    if (j === 0) return secant(0, c);
    if (j === keys.length - 1) return secant(j - 1, c);
    const [d0, d1] = [secant(j - 1, c), secant(j, c)];
    return d0 * d1 <= 0 ? 0 : 2 / (1 / d0 + 1 / d1);
  };
  const dt = b.t - a.t;
  const s = clamp01((t - a.t) / dt);
  const [s2, s3] = [s * s, s * s * s];
  const h = [2 * s3 - 3 * s2 + 1, s3 - 2 * s2 + s, -2 * s3 + 3 * s2, s3 - s2];
  const v = {} as Record<(typeof ch)[number], number>;
  for (const c of ch) v[c] = h[0]! * val(a, c) + h[1]! * dt * slope(i, c) + h[2]! * val(b, c) + h[3]! * dt * slope(i + 1, c);
  return { ...v, range: Math.exp(v.range), heading: ((v.heading % 360) + 360) % 360 };
}

/** Seslendirme klibinin videodaki yeri (ses miksi buna göre yapılır). */
export interface Cue {
  id: string;
  at: number;
  duration: number;
  words: StoryWord[];
  file?: string;
}

/** Altyazı: en fazla 3 kelimelik parçalar, noktalamada bölünür (Reels tarzı). */
function chunkWords(words: StoryWord[]) {
  const chunks: StoryWord[][] = [];
  let cur: StoryWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 3 || /[.,!?;:]$/.test(w.word)) (chunks.push(cur), (cur = []));
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Halkanın metre cinsinden sınır kutusu ve merkezi. */
function bounds(ring: { lat: number; lng: number }[]) {
  const lats = ring.map((q) => q.lat);
  const lngs = ring.map((q) => q.lng);
  const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  return { center: { lat: (s + n) / 2, lng: (w + e) / 2 }, widthM: (e - w) * 111_320 * k, heightM: (n - s) * 111_320 };
}

/**
 * Zaman çizelgesi parsel ve senaryoya göre bir kez kurulur.
 * story verilirse sahneler seslendirme kadar uzar ve altyazı/ses noktaları üretilir.
 */
export function buildTimeline(p: ParcelInfo, story?: Story) {
  const dur = (id: string) => story?.scenes.find((s) => s.id === id)?.voice?.duration ?? 0;
  const has = (id: string) => !!story?.scenes.some((s) => s.id === id);
  // Kamera menzilleri yarıçapla ölçeklenir. Küçük parselde (745 m², ~22 m) kamera ~120 m'ye iner, kadraj yerde ~50 m kalır:
  // Google karo dokusu o yakınlıkta yetmez, görüntü büyütülmüş / bulanık çıkar. 50 m tabanla kuşbakışı kadraj ~100 m (~10 cm/piksel).
  const r = Math.max(50, p.radiusM);
  const P = p.centroid;
  const h0 = p.longestEdgeHeading;
  const hood = p.hood && p.hood.ring.length > 2 ? p.hood : null;

  // ---- Sahne süreleri (anlatım + nefes payı, en az görsel süre) ----
  const T_HOOK = Math.max(3.4, 0.3 + dur("hook") + 0.5);
  const T_REGION = Math.max(hood ? 4.6 : 3.2, 0.2 + dur("region") + 0.6);
  const DIVE = 2.0; // bölge planından parselin üstüne iniş
  const T_SCAN = Math.max(3.0, dur("scan") + 1.0);
  const T_FEAT = Math.max(story?.features?.length ? 6.5 : 4, 0.3 + dur("features") + 0.8);
  const T_FINAL = Math.max(4.8, 0.4 + dur("final") + 1.6);

  const t1 = T_HOOK; // kesme: bölge
  const tDive = t1 + T_REGION;
  const tScan = tDive + DIVE;
  const t3 = tScan + T_SCAN; // kesme: özellikler
  const tMid = t3 + T_FEAT * 0.5; // kesme: vinç
  const t4 = t3 + T_FEAT; // kesme: kapanış
  const duration = t4 + T_FINAL;

  // ---- Kamera çekimleri ----
  const regionView = (() => {
    if (!hood) return { center: P, range: Math.max(1600, r * 28) };
    const b = bounds(hood.ring);
    // Dikey (9:16) kadraj dar: sınırın tamamı sığsın diye genişliğin ~2,3 katı menzil; parsel merkeze yakın kalsın.
    const range = Math.min(16000, Math.max(1400, Math.max(b.widthM * 2.3, b.heightM * 1.35)));
    return { center: { lat: lerp(b.center.lat, P.lat, 0.25), lng: lerp(b.center.lng, P.lng, 0.25) }, range };
  })();
  const K = (t: number, at: { lat: number; lng: number }, range: number, tilt: number, heading: number): Key => ({ t, ...at, range, tilt, heading });
  const shots: Shot[] = [
    // 1 Kanca: alçak, hızlı yaklaşma + yörünge (gerçek drone hissi: ufka yakın bakış).
    { start: 0, end: t1, keys: [K(0, P, r * 11, 74, h0 + 150), K(t1 * 0.55, P, r * 6, 69, h0 + 178), K(t1, P, r * 4.2, 64, h0 + 205)] },
    // 2 Bölge: yukarıdan mahalle sınırı, yavaş dönüş.
    { start: t1, end: tDive, keys: [K(t1, regionView.center, regionView.range * 1.1, 20, h0 - 25), K(tDive, regionView.center, regionView.range, 14, h0 - 8)] },
    // 3 Dalış → tarama (bölgeyle kesintisiz): parselin tam üstüne, kuşbakışı.
    { start: tDive, end: t3, keys: [K(tDive, regionView.center, regionView.range, 14, h0 - 8), K(tScan, P, r * 5.4, 6, h0), K(t3, P, r * 4.8, 4, h0 + 9)] },
    // 4a Alçak yörünge: ilk kutucuklar.
    { start: t3, end: tMid, keys: [K(t3, P, r * 5.6, 66, h0 + 35), K(tMid, P, r * 4.6, 63, h0 + 105)] },
    // 4b Vinç: karşı açıdan alçaktan yükselen plan.
    { start: tMid, end: t4, keys: [K(tMid, P, r * 3.4, 54, h0 + 245), K(t4, P, r * 7.5, 40, h0 + 285)] },
    // 5 Kapanış: kahraman plan, yavaş yörünge ve geri çekilme.
    { start: t4, end: duration, keys: [K(t4, P, r * 6.5, 50, h0 + 120), K(duration, P, r * 9.5, 44, h0 + 165)] },
  ];
  const cuts = [t1, t3, tMid, t4];

  // ---- Seslendirme noktaları ve altyazı ----
  const cueStart: Record<string, number> = { hook: 0.3, region: t1 + 0.4, scan: tScan + 0.2, features: t3 + 0.3, final: t4 + 0.4 };
  const cues: Cue[] = (story?.scenes ?? [])
    .filter((s) => s.voice && cueStart[s.id] !== undefined)
    .map((s) => ({ id: s.id, at: cueStart[s.id]!, duration: s.voice!.duration, words: s.voice!.words, file: s.voice!.file }));
  const captionChunks = cues.flatMap((c) =>
    chunkWords(c.words).map((ws) => ({
      words: ws.map((w) => ({ word: w.word, start: c.at + w.start, end: c.at + w.end })),
      start: c.at + ws[0]!.start - 0.08,
      end: c.at + ws[ws.length - 1]!.end + 0.15,
    })),
  );
  function captionAt(t: number): FrameState["caption"] {
    const i = captionChunks.findIndex((c, k) => t >= c.start && t < (captionChunks[k + 1]?.start ?? c.end + 0.6) && t < c.end + 0.6);
    if (i < 0) return null;
    const c = captionChunks[i]!;
    let active = 0;
    c.words.forEach((w, k) => t >= w.start - 0.03 && (active = k));
    return { words: c.words.map((w) => w.word), active, pop: span(t, c.start, c.start + 0.18) };
  }

  // Özellik kutucukları: 4a ve 4b'ye bölünür, her biri 0,55 sn arayla gelir; kapanışta çekilir.
  const feats = story?.features ?? [];
  const firstHalf = Math.ceil(feats.length / 2);
  const featIn = feats.map((_, i) => (i < firstHalf ? t3 + 0.5 + i * 0.6 : tMid + 0.4 + (i - firstHalf) * 0.6));

  const hookLines = story?.hookLines ?? [];

  function frameState(t: number): FrameState {
    const shot = shots.find((s) => t < s.end) ?? shots[shots.length - 1]!;
    const cam = shotCamera(shot.keys, Math.min(t, shot.end));
    // Drone yatışı: yön değişim hızıyla orantılı, dönüşe doğru (en fazla 9°).
    const ahead = shotCamera(shot.keys, Math.min(t + 0.05, shot.end));
    const dh = ((((ahead.heading - cam.heading) % 360) + 540) % 360) - 180;
    const roll = Math.max(-9, Math.min(9, (dh / 0.05) * 0.2));
    const features: FeatureChip[] = feats.map((f, i) => ({ ...f, progress: Math.min(easeOutBack(span(t, featIn[i]!, featIn[i]! + 0.45)), 1 - span(t, t4 - 0.3, t4)) }));
    const scanP = smoother(span(t, tScan + 0.1, tScan + Math.min(2.4, T_SCAN - 0.4)));
    return {
      camera: { ...cam, altitude: p.elevation ?? 0, roll },
      mode: t >= t1 && t < tDive + 0.6 ? "HYBRID" : "SATELLITE",
      // Kontur kancada çizilir; bölge planında da görünür (pinin altında küçük), taramada dolgu ızgaraya geçer.
      neon: span(t, 0.4, 1.9),
      fill: t < tScan ? span(t, 1.2, 2.4) * 0.7 : Math.max(0.25, 1 - span(t, tScan, tScan + 0.5)),
      hood: hood ? { draw: smoother(span(t, t1 + 0.3, t1 + 2.1)), fill: span(t, t1 + 1.6, t1 + 2.4), opacity: 1 - span(t, tScan - 0.6, tScan) } : null,
      pin: { drop: smoother(span(t, t1 + 0.9, t1 + 1.7)), pulse: Math.max(0, t - (t1 + 1.6)) / 1.4, opacity: t >= t1 && t < tScan - 0.3 ? 1 : 0 },
      scan: t >= tScan && t < t3 ? { progress: scanP, line: Math.min(span(t, tScan, tScan + 0.2), 1 - span(t, tScan + 2.3, tScan + 2.6)), grid: span(t, tScan, tScan + 0.3) } : null,
      // Çit duvarı: özellik bölümünde yerden yükselir, sonuna kadar kalır.
      fence: span(t, t3 + 0.15, t3 + 1.1),
      hook: hookLines.length ? { lines: hookLines, progress: Math.min(span(t, 0.15, 0.6), 1 - span(t, t1 - 0.35, t1)) } : null,
      place: story?.place ? { ...story.place, progress: Math.min(span(t, t1 + 1.3, t1 + 1.8), 1 - span(t, tDive + 0.2, tDive + 0.6)) } : null,
      area: {
        progress: t < t4 ? Math.min(span(t, tScan + 0.1, tScan + 0.5), 1 - span(t, t3 - 0.3, t3)) : span(t, t4 + 0.6, t4 + 1.1),
        counter: t < t4 ? scanP : 1,
        sub: t >= t4 ? story?.place?.title : undefined,
      },
      features,
      caption: captionAt(t),
      endcard: story?.endcard ? { ...story.endcard, progress: span(t, duration - 3.0, duration - 2.4) } : null,
      flash: Math.max(0, ...cuts.map((c) => Math.min(span(t, c - 0.08, c), 1 - span(t, c, c + 0.35)) * 0.6)),
      contact:
        story?.endcard?.officeName || story?.endcard?.phone
          ? { officeName: story.endcard.officeName, phone: story.endcard.phone, progress: Math.min(span(t, t1, t1 + 0.5), 1 - span(t, duration - 3.2, duration - 2.8)) }
          : null,
    };
  }

  /** Geçiş sesleri: her kesme + dalış başlangıcı. */
  const whooshes = [...cuts, tDive + 0.1];
  /** İnşaat sahnesinin başlangıç karesi: alçak yörüngenin başı (parsel ortada, eğik bakış). */
  const keyframe = frameState(t3 + 0.05);
  return { duration, frameState, cues, whooshes, keyframe, has };
}
