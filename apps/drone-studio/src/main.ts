/**
 * Drone stüdyosu: Google fotogerçekçi 3D haritada parseli neon çizgiyle gösterir, çevredeki önemli
 * noktaları (okul, ulaşım, ana yol...) çizgilerle bağlar ve kayıt script'ine (scripts/record.ts)
 * kare kare kontrol için window.studio arayüzü sunar.
 *
 * Tarayıcı önizlemesi: http://localhost:5178/?parcel=assets/parcels/<dosya>.geojson (veya .kml)
 */
import { formatArea, formatDistance } from "@arsa/geo";

export interface ParcelInfo {
  name?: string;
  properties: Record<string, string>;
  ring: { lat: number; lng: number }[];
  centroid: { lat: number; lng: number };
  areaM2: number;
  radiusM: number;
  longestEdgeHeading: number;
  elevation: number | null;
  address: { province?: string; district?: string; neighbourhood?: string };
  pois: { label: string; emoji: string; name?: string; position: { lat: number; lng: number }; distanceM: number }[];
}

export interface Camera {
  lat: number;
  lng: number;
  /** Bakılan noktanın deniz seviyesine göre yüksekliği (m). */
  altitude: number;
  range: number;
  tilt: number;
  heading: number;
}

/** Bir karenin tüm görsel durumu; değerler 0..1 arası animasyon ilerlemesidir. */
export interface FrameState {
  camera: Camera;
  neon: number; // parsel konturunun çizilmiş oranı
  fill: number; // parsel dolgusunun görünürlüğü
  title: number; // m² kartı
  counter: number; // m² sayacının ilerlemesi
  location: number; // konum satırı
  poiLines: number; // parselden çevre noktalarına uzanan çizgiler
  pills: number[]; // her çevre etiketinin ilerlemesi
}

const NEON = "#00e5ff";
/** Haritada çizgiyle bağlanacak en uzak nokta; daha uzaktakiler (ör. 16 km'deki ilçe merkezi) yalnızca listede. */
const MAX_LINE_DISTANCE_M = 6000;
const AMBER = "#ffc83d";
const status = (t: string) => ((document.getElementById("status") as HTMLElement).textContent = t);

function fitStage() {
  const stage = document.getElementById("stage") as HTMLElement;
  const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  stage.style.transform = s < 1 ? `scale(${s})` : "";
}
window.addEventListener("resize", fitStage);
fitStage();

async function loadGoogleMaps(key: string): Promise<void> {
  if ((window as any).google?.maps?.importLibrary) return;
  await new Promise<void>((resolve, reject) => {
    const cb = `__gmapsReady${Date.now()}`;
    (window as any)[cb] = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=beta&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps JS yüklenemedi"));
    document.head.appendChild(s);
  });
}

let lib: any;
let map: any;
let parcel: ParcelInfo;
let fillEl: any;
let outlineEl: any;
let poiLineEls: any[] = [];
let poiMarkerEls: any[] = [];
let poisShown = false;
let steady = false;
const steadyWaiters: (() => void)[] = [];

/** Harita karoları tamamen yüklenene kadar bekler (gmp-steadychange isSteady=true). */
function waitSteady(timeoutMs = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    // Değişiklik steady durumunu bozmayacak kadar küçükse olay gelmeyebilir; kısa bir pencere bekle.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (steady) setTimeout(() => (steady ? resolve(true) : steadyWaiters.push(() => resolve(true))), 120);
        else steadyWaiters.push(() => resolve(true));
      }),
    );
    setTimeout(() => resolve(false), timeoutMs);
  });
}

// ---- Parsel konturunu çevre boyunca kısmi çizmek için kümülatif uzunluklar ----
let perimeter: { lat: number; lng: number; altitude: number }[] = [];
let cumLen: number[] = [];
function preparePerimeter() {
  const pts = parcel.ring.map((p) => ({ lat: p.lat, lng: p.lng, altitude: 1.5 }));
  perimeter = [...pts, pts[0]!];
  cumLen = [0];
  const k = Math.cos((parcel.centroid.lat * Math.PI) / 180);
  for (let i = 1; i < perimeter.length; i++) {
    const a = perimeter[i - 1]!;
    const b = perimeter[i]!;
    cumLen.push(cumLen[i - 1]! + Math.hypot((b.lat - a.lat) * 111_320, (b.lng - a.lng) * 111_320 * k));
  }
}
function partialPerimeter(p: number) {
  const target = cumLen[cumLen.length - 1]! * Math.max(0, Math.min(1, p));
  const out = [perimeter[0]!];
  for (let i = 1; i < perimeter.length; i++) {
    if (cumLen[i]! <= target) {
      out.push(perimeter[i]!);
      continue;
    }
    const a = perimeter[i - 1]!;
    const b = perimeter[i]!;
    const t = (target - cumLen[i - 1]!) / (cumLen[i]! - cumLen[i - 1]!);
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, altitude: 1.5 });
    break;
  }
  return out;
}

async function createScene() {
  lib = await (window as any).google.maps.importLibrary("maps3d");
  const { Map3DElement, Polygon3DElement, Polyline3DElement, MapMode, AltitudeMode } = lib;

  map = new Map3DElement({
    center: { lat: parcel.centroid.lat, lng: parcel.centroid.lng, altitude: parcel.elevation ?? 0 },
    range: Math.max(1500, parcel.radiusM * 30),
    tilt: 30,
    heading: 0,
    mode: MapMode.SATELLITE,
    defaultUIHidden: true,
  });
  map.addEventListener("gmp-steadychange", (e: any) => {
    steady = !!e.isSteady;
    if (steady) steadyWaiters.splice(0).forEach((f) => f());
  });
  document.getElementById("map")!.appendChild(map);

  preparePerimeter();
  fillEl = new Polygon3DElement({
    path: perimeter.slice(0, -1),
    altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
    fillColor: "rgba(0, 229, 255, 0)",
    strokeColor: "rgba(0,0,0,0)",
    strokeWidth: 0,
    drawsOccludedSegments: true,
  });
  // outerWidth, strokeWidth'in dış hale rengine ayrılan oranıdır (0..1): beyaz çekirdek + camgöbeği hale.
  outlineEl = new Polyline3DElement({
    path: [perimeter[0], perimeter[0]],
    altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
    strokeColor: "#f2ffff",
    strokeWidth: 16,
    outerColor: NEON,
    outerWidth: 0.62,
    drawsOccludedSegments: true,
  });
  map.append(fillEl, outlineEl);

  // Çevre noktaları: parselden noktaya amber çizgi + direkli işaret.
  const { Marker3DElement } = lib;
  const origin = { lat: parcel.centroid.lat, lng: parcel.centroid.lng, altitude: 3 };
  for (const poi of parcel.pois.filter((p) => p.distanceM <= MAX_LINE_DISTANCE_M)) {
    poiLineEls.push(
      new Polyline3DElement({
        path: [origin, origin], // boş yol kabul edilmiyor; render() uzatır
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        strokeColor: "#fff3cf",
        strokeWidth: 9,
        outerColor: AMBER,
        outerWidth: 0.55,
        drawsOccludedSegments: true,
      }),
    );
    poiMarkerEls.push(
      new Marker3DElement({
        position: { lat: poi.position.lat, lng: poi.position.lng, altitude: 40 },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        extruded: true,
        label: `${poi.emoji} ${formatDistance(poi.distanceM)}`,
        sizePreserved: true,
      }),
    );
  }
}

function buildOverlay() {
  const p = parcel.properties;
  const title = document.getElementById("title")!;
  title.querySelector(".sub")!.textContent = [
    p.Nitelik,
    p.Ada && p.ParselNo ? `${p.Ada} Ada · ${p.ParselNo} Parsel` : undefined,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const district = p.Ilce ?? parcel.address.district;
  const province = p.Il ?? parcel.address.province;
  const hood = p.Mahalle ?? parcel.address.neighbourhood;
  const loc = document.getElementById("location")!;
  loc.textContent = `📍 ${[district, province].filter(Boolean).join(", ")}${hood ? `  ·  ${hood.replace(/ Mahallesi$/, "")} Mah.` : ""}`;
  if (p.Mevkii) {
    const m = document.createElement("span");
    m.className = "mevkii";
    m.textContent = `${p.Mevkii} Mevkii`;
    loc.appendChild(m);
  }

  const list = document.getElementById("pois")!;
  list.innerHTML = "";
  for (const poi of parcel.pois) {
    const el = document.createElement("div");
    el.className = "pill anim";
    el.innerHTML = `<div class="emoji"></div><div class="txt"><div class="main"></div><div class="name"></div></div>`;
    el.querySelector(".emoji")!.textContent = poi.emoji;
    el.querySelector(".main")!.innerHTML = `${poi.label} · <b>${formatDistance(poi.distanceM)}</b>`;
    el.querySelector(".name")!.textContent = poi.name ?? "";
    list.appendChild(el);
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
function setAnim(el: HTMLElement, p: number, dy = 26, dx = 0) {
  const e = easeOut(clamp01(p));
  el.style.opacity = String(e);
  el.style.transform = `translate(${(1 - e) * dx}px, ${(1 - e) * dy}px) scale(${0.94 + 0.06 * e})`;
}

const studio = {
  parcel: null as ParcelInfo | null,

  async load(file: string): Promise<ParcelInfo> {
    const key = import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");
    status("parsel ve çevre bilgisi okunuyor…");
    const res = await fetch(`/api/parcel?file=${encodeURIComponent(file)}`);
    const data = (await res.json()) as ParcelInfo & { error?: string };
    if (data.error) throw new Error(data.error);
    parcel = this.parcel = data;
    status("harita yükleniyor…");
    await loadGoogleMaps(key);
    await createScene();
    buildOverlay();
    await waitSteady(60000);
    status(`${formatArea(parcel.areaM2)} · rakım ${parcel.elevation?.toFixed(0) ?? "?"} m · ${parcel.pois.length} çevre noktası`);
    return parcel;
  },

  /** Kareyi verilen duruma getirir ve harita karoları yüklenene kadar bekler. */
  async render(s: FrameState, timeoutMs?: number): Promise<boolean> {
    const c = s.camera;
    map.center = { lat: c.lat, lng: c.lng, altitude: c.altitude };
    map.range = c.range;
    map.tilt = c.tilt;
    map.heading = c.heading;

    outlineEl.path = s.neon <= 0 ? [perimeter[0], perimeter[0]] : partialPerimeter(easeOut(s.neon));
    fillEl.fillColor = `rgba(0, 229, 255, ${(0.2 * clamp01(s.fill)).toFixed(3)})`;

    // Çevre çizgileri: parsel merkezinden noktaya doğru uzayarak çizilir.
    const show = s.poiLines > 0;
    if (show !== poisShown) {
      if (show) map.append(...poiLineEls, ...poiMarkerEls);
      else [...poiLineEls, ...poiMarkerEls].forEach((el) => el.remove());
      poisShown = show;
    }
    if (show) {
      const k = easeOut(clamp01(s.poiLines));
      parcel.pois.filter((p) => p.distanceM <= MAX_LINE_DISTANCE_M).forEach((poi, i) => {
        const a = parcel.centroid;
        const b = poi.position;
        poiLineEls[i].path = [
          { lat: a.lat, lng: a.lng, altitude: 3 },
          { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k, altitude: 3 },
        ];
      });
    }

    const title = document.getElementById("title")!;
    setAnim(title, s.title);
    title.querySelector(".area")!.textContent = formatArea(parcel.areaM2 * easeOut(clamp01(s.counter)));
    setAnim(document.getElementById("location")!, s.location, 20);
    document.querySelectorAll<HTMLElement>("#pois .pill").forEach((el, i) => setAnim(el, s.pills[i] ?? 0, 0, -60));

    return waitSteady(timeoutMs);
  },

  /** Tüm yazı ve çizimleri gizler (inşaat sahnesi için temiz son kare). */
  async clean(keepNeon: boolean): Promise<boolean> {
    for (const id of ["title", "location"]) (document.getElementById(id) as HTMLElement).style.opacity = "0";
    document.querySelectorAll<HTMLElement>("#pois .pill").forEach((el) => (el.style.opacity = "0"));
    if (!keepNeon) [fillEl, outlineEl].forEach((el) => el.remove());
    return waitSteady();
  },

  setChrome(visible: boolean) {
    (document.getElementById("status") as HTMLElement).style.display = visible ? "" : "none";
  },
};
(window as any).studio = studio;

// Tarayıcı önizlemesi: ?parcel=... verilmişse yükle ve son kareyi göster.
const file = new URLSearchParams(location.search).get("parcel") ?? new URLSearchParams(location.search).get("kml");
if (file) {
  studio
    .load(file)
    .then((p) =>
      studio.render({
        camera: {
          lat: p.centroid.lat,
          lng: p.centroid.lng,
          altitude: p.elevation ?? 0,
          range: Math.max(150, p.radiusM * 6),
          tilt: 55,
          heading: (p.longestEdgeHeading + 30) % 360,
        },
        neon: 1,
        fill: 1,
        title: 1,
        counter: 1,
        location: 1,
        poiLines: 0,
        pills: p.pois.map(() => 1),
      }),
    )
    .catch((e) => status(`HATA: ${e.message}`));
} else if (!(window as any).__RECORDER__) {
  status("?parcel=assets/parcels/<dosya>.geojson parametresi verin");
}
