/**
 * Drone kurgusu: parsel ve çevre bilgisine göre kamera yolu ve her karenin görsel durumu.
 *
 *   Açılış (3,5 sn)   yüksekten parsele dalış, neon kontur çizilir; kanca: m² sayacı + konum ilk saniyelerde
 *   Çevre turu        en önemli 3 yer: parselden yere drone uçuşu (yüksel → ilerle → alçal, süre mesafeye göre),
 *                     yerin üstünde süzülerek duruş + büyük kart, parsele dönüş (bir sonraki hedefe dönerek)
 *   Özet (2,8 sn)     kamera yükselir: parsel tüm yerlere bağlı ağ olarak görünür
 *   Final (6 sn)      parsele dalış, etrafında tur, m² ve konum; sabitlenen son kare inşaatın başlangıcı
 *
 * Kamera hiçbir yerde tam durmaz: uçuşlar yumuşak başlayıp biter, duruşlar sabit hızlı süzülmedir.
 */
import type { FrameState, ParcelInfo } from "../src/main.js";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** t'nin [a, b] aralığındaki ilerlemesi (0..1). */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** Uçlarda hız ve ivme sıfır: kamerada sarsıntısız kalkış/varış. */
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** En kısa yönden açı geçişi (359° → 1° arası 2°). */
const lerpAngle = (a: number, b: number, u: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

/**
 * Kamera anahtar karesi; geçiş bu kareye gelen yolu tanımlar.
 *   ease   yumuşak başla/bitir (varsayılan)
 *   drift  sabit hızlı süzülme (duruşlar: kamera durmaz)
 *   fly    drone uçuşu: yol boyunca peak menziline yükselip alçalır, uçuşun ortasında harita biraz daha yukarıdan görünür
 */
type Key = { t: number; lat: number; lng: number; range: number; tilt: number; heading: number; move?: "ease" | "drift" | "fly"; peak?: number };

/** Uçuşta menzil (log) eğrisi: uçlar arasında logaritmik geçiş + ortada peak'e yükselme. */
function flyLogRange(a: Key, b: Key, u: number) {
  const la = Math.log(a.range);
  const lb = Math.log(b.range);
  const lift = b.peak ? Math.max(0, Math.log(b.peak) - Math.max(la, lb)) : 0;
  return lerp(la, lb, u) + lift * Math.sin(Math.PI * u);
}

/**
 * Uçuşta yatay ilerleme: ekrandaki kayma hızı ≈ yer hızı / menzil. İlerlemeyi menzille ağırlıklandırınca
 * kamera alçaktayken yavaş, yüksekteyken hızlı ilerler, ekranda akış düzgün olur (van Wijk fly-to).
 */
const flyTables = new WeakMap<Key, number[]>();
function flyProgress(a: Key, b: Key, u: number) {
  let table = flyTables.get(b);
  if (!table) {
    const N = 200;
    table = [0];
    for (let i = 1; i <= N; i++) {
      const v = (i - 0.5) / N;
      // smoother'ın türevi (30v²(1-v)²) zamanlamayı, menzil ise o andaki ekran ölçeğini verir.
      table.push(table[i - 1]! + Math.exp(flyLogRange(a, b, v)) * 30 * v * v * (1 - v) * (1 - v));
    }
    const total = table[N]!;
    table = table.map((x) => x / total);
    flyTables.set(b, table);
  }
  const x = u * (table.length - 1);
  const i = Math.min(table.length - 2, Math.floor(x));
  return lerp(table[i]!, table[i + 1]!, x - i);
}

function cameraAt(keys: Key[], t: number) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t <= keys[j + 1]!.t);
  if (i < 0) i = keys.length - 2;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const raw = span(t, a.t, b.t);
  const u = b.move === "drift" ? raw : smoother(raw);
  const fly = b.move === "fly";
  // Menzil logaritmik uzayda: geniş açıdan yakına geçiş doğal.
  const logRange = fly ? flyLogRange(a, b, u) : lerp(Math.log(a.range), Math.log(b.range), u);
  const tilt = lerp(a.tilt, b.tilt, u) - (fly ? 14 * Math.sin(Math.PI * u) : 0);
  const s = fly ? flyProgress(a, b, raw) : u;
  return {
    lat: lerp(a.lat, b.lat, s),
    lng: lerp(a.lng, b.lng, s),
    range: Math.exp(logRange),
    tilt,
    heading: lerpAngle(a.heading, b.heading, u),
    /** Konumun a→b ilerlemesi: bağlantı çizgisinin ucu ekran merkeziyle birlikte gider. */
    progress: s,
  };
}

/** Zaman çizelgesi parsel ve çevre bilgisine göre bir kez kurulur. */
export function buildTimeline(p: ParcelInfo) {
  const r = Math.max(25, p.radiusM);
  const P = p.centroid;
  const h0 = (p.longestEdgeHeading + 25) % 360;
  const Rp = Math.max(r * 12, 900); // turda parselin görüldüğü mesafe

  // En önemli 3 yer (öncelik sırası API'den gelir); çok uzaktakiler uçuşu uzatır.
  const tour = p.pois
    .map((poi, index) => ({ poi, index }))
    .filter(({ poi }) => poi.distanceM <= 20000)
    .slice(0, 3)
    .map((s) => {
      // Uçuş süresi mesafeyle logaritmik artar: 1,2 km ≈ 2,5 sn, 4 km ≈ 3,3 sn, 16 km ≈ 4,2 sn.
      const out = Math.min(4.4, Math.max(2.4, 1.6 + 0.65 * Math.log(s.poi.distanceM / 300)));
      return { ...s, out, hold: 1.3, back: Math.max(2, out * 0.8) };
    });

  const INTRO = 3.5;
  let T = INTRO;
  const legs = tour.map((s) => {
    const leg = { ...s, start: T, arrive: T + s.out, leave: T + s.out + s.hold, end: T + s.out + s.hold + s.back };
    T = leg.end;
    return leg;
  });
  const tourEnd = T;
  const SUMMARY = tour.length ? 2.8 : 0;
  const finalStart = tourEnd + SUMMARY;
  const FINAL = 6;
  const duration = finalStart + FINAL;

  const keys: Key[] = [
    // Açılış: yüksekten, düz bakışla parsele dalış ve dönüş.
    { t: 0, ...P, range: Math.max(3200, r * 55), tilt: 12, heading: h0 - 70 },
    { t: INTRO, ...P, range: Rp * 0.85, tilt: 45, heading: legs[0] ? bearing(P, legs[0].poi.position) - 15 : h0 },
  ];
  legs.forEach((leg, k) => {
    const dir = bearing(P, leg.poi.position);
    // Yerin üstünde: uçuş yönüne bakış, hedef ekran ortasında; yolculuk sırasında iki uç birlikte görünsün diye yükselme.
    const Rpoi = Math.min(1500, Math.max(450, leg.poi.distanceM * 0.22));
    const peak = leg.poi.distanceM * 0.5;
    keys.push({ t: leg.arrive, ...leg.poi.position, range: Rpoi, tilt: 50, heading: dir, move: "fly", peak });
    keys.push({ t: leg.leave, ...leg.poi.position, range: Rpoi * 0.86, tilt: 53, heading: dir + 10, move: "drift" });
    // Dönüşte bir sonraki hedefe doğru dönerek parsele in: sonraki uçuş dönmeden başlar.
    const next = legs[k + 1];
    const nextHeading = next ? bearing(P, next.poi.position) - 15 : dir + 40;
    keys.push({ t: leg.end, ...P, range: Rp, tilt: 45, heading: nextHeading, move: "fly", peak });
  });
  const hEnd = keys[keys.length - 1]!.heading;
  if (legs.length) {
    // Özet: bağlantı ağı tek karede — en uzak yer bile ekranın kenarına yakın görünsün.
    const far = Math.max(...legs.map((l) => l.poi.distanceM));
    const Rs = Math.min(9000, Math.max(2200, far * 0.55));
    keys.push(
      { t: tourEnd + 1.7, ...P, range: Rs, tilt: 30, heading: hEnd + 15 },
      { t: finalStart, ...P, range: Rs * 0.92, tilt: 32, heading: hEnd + 25, move: "drift" },
    );
  }
  const hf = keys[keys.length - 1]!.heading;
  keys.push(
    { t: finalStart + 2.2, ...P, range: r * 7.5, tilt: 52, heading: hf + 30 },
    { t: duration - 0.4, ...P, range: r * 6.1, tilt: 57, heading: hf + 120, move: "drift" },
    { t: duration, ...P, range: r * 6.0, tilt: 57, heading: hf + 126, move: "drift" },
  );

  function frameState(t: number): FrameState {
    const cam = cameraAt(keys, t);
    const lines = p.pois.map(() => 0);
    const markers = p.pois.map(() => 0);
    const pills = p.pois.map(() => 0);
    let card: FrameState["card"] = null;
    const dive = finalStart + 0.6; // finale dalışta tur grafikleri çekilir
    legs.forEach((leg) => {
      // Çizgi ucu kamera merkeziyle aynı ilerler: ekranda hedefe "çekiliyormuş" gibi görünür.
      if (t >= leg.start && t < dive) lines[leg.index] = t < leg.arrive ? cam.progress : 1;
      markers[leg.index] = t >= leg.start + leg.out * 0.7 && t < dive ? 1 : 0;
      if (t >= leg.arrive - 0.3 && t <= leg.leave + 0.3) {
        card = { index: leg.index, progress: Math.min(span(t, leg.arrive - 0.3, leg.arrive + 0.2), 1 - span(t, leg.leave, leg.leave + 0.3)) };
      }
      // Ziyaret edilen yer dönüşte soldaki listeye eklenir; finalde liste çekilir.
      pills[leg.index] = Math.min(span(t, leg.leave + 0.1, leg.leave + 0.5), 1 - span(t, dive - 0.4, dive + 0.2));
    });
    // m² kartı: açılışta kanca olarak, turda gizli (yer kartıyla çakışmasın), finalde yeniden.
    const hookOut = legs.length ? 1 - span(t, INTRO - 0.4, INTRO + 0.1) : 1;
    const title = t < finalStart ? Math.min(span(t, 0.4, 1.0), hookOut) : span(t, finalStart + 1.6, finalStart + 2.2);
    return {
      camera: { ...cam, altitude: p.elevation ?? 0 },
      mode: t > INTRO - 0.5 && t < dive ? "HYBRID" : "SATELLITE",
      neon: span(t, 1.2, 3.0),
      fill: span(t, 1.8, 3.2),
      lines,
      markers,
      pills,
      card,
      title,
      counter: span(t, 0.5, 2.6),
      location: t < finalStart ? Math.min(span(t, 1.2, 1.7), hookOut) : span(t, finalStart + 2.4, finalStart + 3.0),
    };
  }
  return { duration, frameState, tour };
}
