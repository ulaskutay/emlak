/**
 * Yaklaşma çekimi (inşaat videosunun açılışı), kullanıcının tarayıcısında: kamera mahallenin yukarısından parsele
 * alçalır ve inşaatın başlangıç karesinin kamerasında (side-shot.ts) durur; video oradan inşaata geçer.
 *
 * Kareler tek tek çizilir (her karede karolar yüklenene kadar beklenir, render.ts'deki gibi), yakın yerlerin
 * etiketleri ve Google atfı tuvale işlenir (konum ve m² worker'ın veri kartında yazar; üst bölge ona bırakılır), WebCodecs ile H.264 MP4'e kodlanır. 6 sn'lik çekim için
 * GPU sunucusu (RunPod) gerekmesin diye kullanıcının GPU'su kullanılır (2026-10-29); sunucuda GPU yok.
 */
import { defaultSideShot, sideState } from "./side-shot.js";
import { sleep } from "./timer.js";
import type { Camera, FrameState, ParcelInfo } from "./types.js";

/** MP4 paketleyici (CDN'den, Cesium gibi): depoya bağımlılık eklemeden. */
const MUXER_URL = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/+esm";
/** Sahne (CSS) boyutu: kamera izdüşümü bu koordinatlarda. */
const STAGE_W = 1080;

export interface ApproachHost {
  render(s: FrameState, timeoutMs?: number): Promise<boolean>;
  canvas(): HTMLCanvasElement;
  project(q: { lat: number; lng: number }, dh?: number): { x: number; y: number } | null;
}

export interface ApproachOptions {
  seconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  /** done: 0..1; frame: son kare (önizleme için). */
  onProgress?: (done: number, frame: HTMLCanvasElement) => void;
  signal?: AbortSignal;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Başta ve sonda yumuşak (hız sıfır): son kare durağan inşaat karesine kesintisiz bağlanır. */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** a→b açı farkı en kısa yönden. */
const angleLerp = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
/** t, [a, b] aralığında 0→1 (dışında 0 ya da 1). */
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

function startCamera(p: ParcelInfo, end: Camera): Camera {
  const r = Math.max(50, p.radiusM);
  // Mahalle sınırı varsa başlangıç mahallenin ortasına doğru kayar: çevre (yerleşim, yollar) kadraja girer.
  const ring = p.hood?.ring && p.hood.ring.length > 2 ? p.hood.ring : null;
  const hc = ring
    ? { lat: ring.reduce((s, q) => s + q.lat, 0) / ring.length, lng: ring.reduce((s, q) => s + q.lng, 0) / ring.length }
    : p.centroid;
  return {
    lat: lerp(hc.lat, p.centroid.lat, 0.6),
    lng: lerp(hc.lng, p.centroid.lng, 0.6),
    altitude: 0,
    range: Math.min(3500, Math.max(1200, r * 24)),
    tilt: 32,
    heading: end.heading - 60,
  };
}

/** t anındaki kare durumu: yükseklik logaritmik iner (yukarıda hızlı, yere yaklaştıkça yavaş). */
function stateAt(p: ParcelInfo, a: Camera, b: Camera, t: number): FrameState {
  const e = smooth(t);
  return {
    camera: {
      lat: lerp(a.lat, b.lat, e),
      lng: lerp(a.lng, b.lng, e),
      altitude: 0,
      range: Math.exp(lerp(Math.log(a.range), Math.log(b.range), e)),
      tilt: lerp(a.tilt, b.tilt, e),
      heading: angleLerp(a.heading, b.heading, e),
    },
    mode: "SATELLITE",
    // Parsel sınırı ilk dörtte birde çizilir, iniş boyunca görünür; inşaat karesine geçişte (worker) kaybolur.
    neon: ramp(t, 0.04, 0.28),
    fill: 0.18 * ramp(t, 0.1, 0.3),
    fence: 0,
  };
}

/** Etiketlenecek yakın yerler: en yakından, farklı türlerden en fazla 4 (aynı türden ikincisi alınmaz). */
function pickPois(p: ParcelInfo) {
  const seen = new Set<string>();
  return [...p.pois]
    .filter((q) => q.distanceM <= 20_000)
    .sort((a, b) => a.distanceM - b.distanceM)
    .filter((q) => {
      const k = q.category ?? q.label;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 4);
}

const distanceText = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: m < 10_000 ? 1 : 0 })} km`;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Yere iğneli etiket: nokta + ince çizgi + üstte koyu hap (emoji, ad, uzaklık). */
function drawPin(g: CanvasRenderingContext2D, k: number, x: number, y: number, text: string, sub: string, alpha: number) {
  const W = g.canvas.width;
  const H = g.canvas.height;
  // Üst bölge (y < 600) worker'ın veri kartına ayrılmış: iğnenin kutusu kartın altında kalsın.
  if (alpha <= 0 || x < 40 * k || x > W - 40 * k || y < 600 * k || y > H - 120 * k) return;
  g.save();
  g.globalAlpha = alpha;
  const stem = 70 * k;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 3 * k;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - stem);
  g.stroke();
  g.fillStyle = "#ffc24d";
  g.beginPath();
  g.arc(x, y, 7 * k, 0, Math.PI * 2);
  g.fill();
  g.font = `800 ${34 * k}px Inter, system-ui, sans-serif`;
  const tw = g.measureText(text).width;
  g.font = `700 ${28 * k}px Inter, system-ui, sans-serif`;
  const sw = g.measureText(sub).width;
  const pad = 22 * k;
  const w = Math.max(tw, sw) + pad * 2;
  const h = 96 * k;
  const bx = Math.max(16 * k, Math.min(W - w - 16 * k, x - w / 2));
  const by = y - stem - h;
  roundRect(g, bx, by, w, h, 22 * k);
  g.fillStyle = "rgba(8, 20, 28, 0.78)";
  g.fill();
  g.strokeStyle = "rgba(255, 194, 77, 0.9)";
  g.lineWidth = 2.5 * k;
  g.stroke();
  g.fillStyle = "#fff";
  g.textBaseline = "top";
  g.font = `800 ${34 * k}px Inter, system-ui, sans-serif`;
  g.fillText(text, bx + pad, by + 14 * k);
  g.fillStyle = "#ffd99a";
  g.font = `700 ${28 * k}px Inter, system-ui, sans-serif`;
  g.fillText(sub, bx + pad, by + 56 * k);
  g.restore();
}

/** Google Photorealistic 3D Tiles atfı (kullanım koşulu): sağ altta, her karede. */
function drawCredit(g: CanvasRenderingContext2D, k: number) {
  g.save();
  g.font = `600 ${22 * k}px Inter, system-ui, sans-serif`;
  g.textAlign = "right";
  g.textBaseline = "bottom";
  g.lineWidth = 3 * k;
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.strokeText("Görüntüler © Google", g.canvas.width - 18 * k, g.canvas.height - 14 * k);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillText("Görüntüler © Google", g.canvas.width - 18 * k, g.canvas.height - 14 * k);
  g.restore();
}

/** Yaklaşma çekimini kaydeder; H.264 MP4 döndürür. Tarayıcı WebCodecs desteklemiyorsa hata fırlatır. */
export async function recordApproach(host: ApproachHost, p: ParcelInfo, o: ApproachOptions = {}): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") throw new Error("Bu tarayıcı video kodlamayı (WebCodecs) desteklemiyor");
  const fps = o.fps ?? 30;
  const W = o.width ?? 720;
  const H = o.height ?? 1280;
  const n = Math.round((o.seconds ?? 6) * fps);
  const k = W / STAGE_W;

  const { Muxer, ArrayBufferTarget } = await import(/* @vite-ignore */ MUXER_URL);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: W, height: H, frameRate: fps }, fastStart: "in-memory" });
  let failure: unknown = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
  const config: VideoEncoderConfig = { codec: "avc1.640028", width: W, height: H, bitrate: 12_000_000, framerate: fps };
  if (!(await VideoEncoder.isConfigSupported(config)).supported) config.codec = "avc1.4d0028";
  if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error("Bu tarayıcı H.264 kodlamayı desteklemiyor");
  encoder.configure(config);

  // Etiket yazı tipi: kayıtta ekran katmanı gizli olduğu için kendiliğinden yüklenmeyebilir.
  await Promise.all(["800 34px Inter", "700 28px Inter"].map((f) => document.fonts.load(f).catch(() => null)));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const end = sideState(p, defaultSideShot(p)).camera;
  const start = startCamera(p, end);
  const pois = pickPois(p);

  for (let i = 0; i < n; i++) {
    if (o.signal?.aborted) throw new DOMException("İptal edildi", "AbortError");
    if (failure) throw failure;
    const t = n > 1 ? i / (n - 1) : 1;
    await host.render(stateAt(p, start, end, t), 20_000);
    g.drawImage(host.canvas(), 0, 0, W, H);
    // Etiketler inişin ortasına kadar; alçaldıkça kadrajdan çıkıyorlar zaten.
    const pinAlpha = ramp(t, 0.04, 0.14) * (1 - ramp(t, 0.5, 0.66));
    for (const q of pois) {
      const s = host.project(q.position, 0);
      // Adı türüyle aynıysa ("Deniz") alt satırda yalnız uzaklık.
      const name = q.name ?? q.label;
      const sub = name === q.label ? distanceText(q.distanceM) : `${q.label} · ${distanceText(q.distanceM)}`;
      if (s) drawPin(g, k, s.x * k, s.y * k, `${q.emoji} ${name}`, sub, pinAlpha);
    }
    drawCredit(g, k);
    const frame = new VideoFrame(out, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
    // Kodlayıcı kuyruğu birikmesin (telefonda bellek).
    while (encoder.encodeQueueSize > 4) await sleep(5);
    o.onProgress?.((i + 1) / n, out);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}
