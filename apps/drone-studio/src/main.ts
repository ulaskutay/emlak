/**
 * Drone stüdyosu: arsa odaklı sahne. Kayıt script'i (scripts/render.ts) window.studio ile her kareyi kurar;
 * görsel durum scripts/timeline.ts'den gelir. Çizim motoru:
 *
 *   cesium  (varsayılan) CesiumJS + Google Photorealistic 3D Tiles — atmosfer, yatış, 3D efektler
 *   google  Google Maps JS Map3DElement — karşılaştırma/yedek (?engine=google)
 *
 * Ekran katmanı (yazılar, kutucuklar) her iki motorda aynı: src/overlay.ts.
 * Tarayıcı önizlemesi: http://localhost:5178/?parcel=assets/parcels/<dosya>.geojson[&engine=google]
 */
import { recordApproach, type ApproachOptions } from "./approach.js";
import { cesiumEngine } from "./engine-cesium.js";
import { googleEngine } from "./engine-google.js";
import { hideOverlay, renderOverlay } from "./overlay.js";
import type { FrameState, ParcelInfo } from "./types.js";

export type { Camera, FeatureChip, FrameState, ParcelInfo } from "./types.js";

const status = (t: string) => ((document.getElementById("status") as HTMLElement).textContent = t);

function fitStage() {
  const stage = document.getElementById("stage") as HTMLElement;
  const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  stage.style.transform = s < 1 ? `scale(${s})` : "";
}
window.addEventListener("resize", fitStage);
fitStage();

const q = new URLSearchParams(location.search);
const engineName = q.get("engine") === "google" ? "google" : "cesium";
// ?record=1: panelde kullanıcının tarayıcısında yaklaşma kaydı (approach.ts): 720×1280 çizim, MSAA hafif.
const recording = q.has("record");
const cesium = cesiumEngine({
  sse: Number(q.get("sse") ?? 4),
  fov: Number(q.get("fov") ?? 42),
  msaa: Number(q.get("msaa") ?? (recording ? 2 : 4)),
  scale: recording ? 720 / 1080 : undefined,
});
const engine = engineName === "google" ? googleEngine() : cesium;
let parcel: ParcelInfo;

const studio = {
  engine: engineName,
  parcel: null as ParcelInfo | null,

  /** Tarayıcı önizlemesi: dosyayı geliştirme sunucusunun /api/parcel uç noktasından hazırlatır. */
  async load(file: string): Promise<ParcelInfo> {
    const key = import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");
    status("parsel ve çevre bilgisi okunuyor…");
    const res = await fetch(`/api/parcel?file=${encodeURIComponent(file)}`);
    const data = (await res.json()) as ParcelInfo & { error?: string };
    if (data.error) throw new Error(data.error);
    return this.loadParcel(data, key);
  },

  /** Hazırlanmış parsel verisiyle sahneyi kurar; API anahtarı çalışma anında verilir (imaja gömülmez). */
  async loadParcel(data: ParcelInfo, key: string): Promise<ParcelInfo> {
    parcel = this.parcel = data;
    status(`harita yükleniyor (${engineName})…`);
    status(`${engineName} · ${await engine.load(data, key)}`);
    return parcel;
  },

  /** Kareyi verilen duruma getirir ve karolar/geometri hazır olana kadar bekler. */
  async render(s: FrameState, timeoutMs?: number): Promise<boolean> {
    renderOverlay(s, parcel);
    return engine.render(s, timeoutMs);
  },

  /** Tüm yazı ve çizimleri gizler (inşaat sahnesi için temiz son kare). */
  async clean(keepNeon: boolean): Promise<boolean> {
    hideOverlay();
    return engine.clean(keepNeon);
  },

  /** Yaklaşma çekimi (yalnız Cesium): parsel yüklendikten sonra; MP4 döndürür. */
  async recordApproach(o: ApproachOptions = {}): Promise<Blob> {
    if (engineName !== "cesium") throw new Error("Yaklaşma kaydı yalnız Cesium motoruyla");
    this.setChrome(false);
    hideOverlay();
    return recordApproach({ render: (s, t) => engine.render(s, t), canvas: () => cesium.canvas(), project: (p, dh) => cesium.project(p, dh) }, parcel, o);
  },

  setChrome(visible: boolean) {
    (document.getElementById("status") as HTMLElement).style.display = visible ? "" : "none";
  },
};
(window as any).studio = studio;

// Tarayıcı önizlemesi: ?parcel=... verilmişse yükle ve parseli göster.
const file = q.get("parcel") ?? q.get("kml");
if (file) {
  studio
    .load(file)
    .then((p) =>
      studio.render({
        camera: { lat: p.centroid.lat, lng: p.centroid.lng, altitude: p.elevation ?? 0, range: Math.max(150, p.radiusM * 6), tilt: 55, heading: (p.longestEdgeHeading + 30) % 360 },
        mode: "SATELLITE",
        neon: 1,
        fill: 1,
        fence: 1,
      }),
    )
    .catch((e) => status(`HATA: ${e.message}`));
} else if (!(window as any).__RECORDER__ && !recording) {
  status("?parcel=assets/parcels/<dosya>.geojson parametresi verin");
}
