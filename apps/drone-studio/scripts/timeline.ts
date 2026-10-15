/**
 * Drone kurgusu: parsel ve çevre bilgisine göre kamera yolu ve her karenin görsel durumu.
 *
 *   Açılış (2,5 sn)   parselin üstü, neon kontur çizilir
 *   Çevre turu        en önemli 3 yer için: parselden yere uçuş (bağlantı çizgisi kamerayla uzar, Google
 *                     yer etiketleri açık), yerin üstünde kısa duruş + büyük kart, parsele dönüş (liste etiketi)
 *   Final (6,5 sn)    parsele dalış, etrafında tur, m² sayacı ve konum; sabitlenen son kare inşaatın başlangıcı
 */
import type { FrameState, ParcelInfo } from "../src/main.js";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** t'nin [a, b] aralığındaki ilerlemesi (0..1). */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** En kısa yönden açı geçişi (359° → 1° arası 2°). */
const lerpAngle = (a: number, b: number, u: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

/** Kamera anahtar karesi. arc: bu kareye giderken kamera yükselip alçalır (iki uç birlikte görünsün). */
type Key = { t: number; lat: number; lng: number; range: number; tilt: number; heading: number; arc?: number };

function cameraAt(keys: Key[], t: number) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t <= keys[j + 1]!.t);
  if (i < 0) i = keys.length - 2;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const u = smooth(span(t, a.t, b.t));
  return {
    lat: lerp(a.lat, b.lat, u),
    lng: lerp(a.lng, b.lng, u),
    // Mesafe logaritmik uzayda: geniş açıdan yakına geçiş doğal; arc ile yolun ortasında yükselme.
    range: Math.exp(lerp(Math.log(a.range), Math.log(b.range), u)) + (b.arc ?? 0) * Math.sin(Math.PI * u),
    tilt: lerp(a.tilt, b.tilt, u),
    heading: lerpAngle(a.heading, b.heading, u),
  };
}

/** Zaman çizelgesi parsel ve çevre bilgisine göre bir kez kurulur. */
export function buildTimeline(p: ParcelInfo) {
  const r = Math.max(25, p.radiusM);
  const P = p.centroid;
  const h0 = (p.longestEdgeHeading + 25) % 360;
  const Rp = Math.max(r * 12, 900); // çevre turunda parselin görüldüğü mesafe

  // En önemli 3 yer (öncelik sırası API'den gelir); çok uzaktakiler uçuşu uzatır.
  const tour = p.pois.map((poi, index) => ({ poi, index })).filter(({ poi }) => poi.distanceM <= 20000).slice(0, 3);

  const INTRO = 2.5;
  const OUT = 1.7;
  const HOLD = 0.9;
  const BACK = 1.2;
  const LEG = OUT + HOLD + BACK;
  const tourEnd = INTRO + tour.length * LEG;
  const FINAL = 6.5;
  const duration = tourEnd + FINAL;

  const keys: Key[] = [
    { t: 0, ...P, range: Rp * 1.25, tilt: 30, heading: h0 - 40 },
    { t: INTRO, ...P, range: Rp, tilt: 42, heading: h0 - 20 },
  ];
  let heading = h0 - 20;
  tour.forEach(({ poi }, k) => {
    const T = INTRO + k * LEG;
    const dir = bearing(P, poi.position);
    // Uçuş yönüne bak: hedef ekranın üst tarafında, bağlantı çizgisi ekranda dikey uzanır.
    const Rpoi = Math.min(1600, Math.max(450, poi.distanceM * 0.25));
    const arc = poi.distanceM * 0.9;
    keys.push({ t: T + OUT, ...poi.position, range: Rpoi, tilt: 50, heading: dir, arc });
    keys.push({ t: T + OUT + HOLD, ...poi.position, range: Rpoi * 0.92, tilt: 52, heading: dir + 8 });
    heading = dir + 8;
    keys.push({ t: T + LEG, ...P, range: Rp, tilt: 42, heading, arc });
  });
  keys.push(
    { t: tourEnd + 2.0, ...P, range: r * 7.5, tilt: 52, heading: heading + 20 },
    { t: tourEnd + 5.5, ...P, range: r * 6.2, tilt: 56, heading: heading + 115 },
    { t: duration, ...P, range: r * 6.0, tilt: 57, heading: heading + 130 },
  );

  function frameState(t: number): FrameState {
    const lines = p.pois.map(() => 0);
    const markers = p.pois.map(() => 0);
    const pills = p.pois.map(() => 0);
    let card: FrameState["card"] = null;
    tour.forEach(({ index }, k) => {
      const T = INTRO + k * LEG;
      // Çizgi kameranın merkeziyle aynı eğriyle uzar: ekranda hedefe "çekiliyormuş" gibi görünür.
      lines[index] = t < tourEnd + 1.6 ? smooth(span(t, T, T + OUT)) : 0;
      markers[index] = t >= T + OUT * 0.6 && t < tourEnd + 1.6 ? 1 : 0;
      if (t >= T + OUT - 0.15 && t <= T + OUT + HOLD + 0.3) {
        card = { index, progress: Math.min(span(t, T + OUT - 0.15, T + OUT + 0.25), 1 - span(t, T + OUT + HOLD, T + OUT + HOLD + 0.3)) };
      }
      // Ziyaret edilen yer dönüşte soldaki listeye eklenir; finalde liste çekilir.
      pills[index] = Math.min(span(t, T + OUT + HOLD + 0.1, T + OUT + HOLD + 0.5), 1 - span(t, tourEnd + 1.0, tourEnd + 1.6));
    });
    return {
      camera: { ...cameraAt(keys, t), altitude: p.elevation ?? 0 },
      mode: t > INTRO - 0.3 && t < tourEnd ? "HYBRID" : "SATELLITE",
      neon: span(t, 0.2, 1.4),
      fill: span(t, 0.8, 1.8),
      lines,
      markers,
      pills,
      card,
      title: span(t, tourEnd + 1.4, tourEnd + 2.0),
      counter: span(t, tourEnd + 1.5, tourEnd + 3.2),
      location: span(t, tourEnd + 2.4, tourEnd + 3.0),
    };
  }
  return { duration, frameState, tour };
}
