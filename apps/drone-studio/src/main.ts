/**
 * Drone stüdyosu: Google fotogerçekçi 3D haritada parseli neon çizgiyle gösterir ve
 * kayıt script'ine (scripts/record.ts) kare kare kamera kontrolü için window.studio arayüzü sunar.
 *
 * Tarayıcıda önizleme: http://localhost:5178/?kml=assets/parcels/<dosya>.kml
 */
import { formatArea } from "@arsa/geo";

export interface ParcelInfo {
  name?: string;
  properties: Record<string, string>;
  ring: { lat: number; lng: number }[];
  centroid: { lat: number; lng: number };
  areaM2: number;
  radiusM: number;
  longestEdgeHeading: number;
  elevation: number | null;
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

const NEON = "#00e5ff";
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

let map: any;
let neon: any[] = [];
let steady = false;
const steadyWaiters: (() => void)[] = [];

/** Harita karoları tamamen yüklenene kadar bekler (gmp-steadychange isSteady=true). */
function waitSteady(timeoutMs = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    // Kamera değişikliği steady durumunu bozmayacak kadar küçükse olay gelmeyebilir; kısa bir pencere bekle.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (steady && performance.now() - start > 0) {
          setTimeout(() => (steady ? resolve(true) : steadyWaiters.push(() => resolve(true))), 120);
        } else {
          steadyWaiters.push(() => resolve(true));
        }
      }),
    );
    setTimeout(() => resolve(false), timeoutMs);
  });
}

async function createMap(parcel: ParcelInfo) {
  const { Map3DElement, Polygon3DElement, Polyline3DElement, MapMode, AltitudeMode } =
    (await (window as any).google.maps.importLibrary("maps3d")) as any;
  const altitude = parcel.elevation ?? 0;

  map = new Map3DElement({
    center: { lat: parcel.centroid.lat, lng: parcel.centroid.lng, altitude },
    range: Math.max(600, parcel.radiusM * 20),
    tilt: 0,
    heading: 0,
    mode: MapMode.SATELLITE,
    defaultUIHidden: true,
  });
  map.addEventListener("gmp-steadychange", (e: any) => {
    steady = !!e.isSteady;
    if (steady) steadyWaiters.splice(0).forEach((f) => f());
  });
  document.getElementById("map")!.appendChild(map);

  // Parsel: yarı saydam dolgu + parlak neon kontur (iç çizgi beyaz, dış hale camgöbeği).
  const path = parcel.ring.map((p) => ({ lat: p.lat, lng: p.lng, altitude: 1.5 }));
  const fill = new Polygon3DElement({
    path,
    altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
    fillColor: "rgba(0, 229, 255, 0.16)",
    strokeColor: "rgba(0,0,0,0)",
    strokeWidth: 0,
    drawsOccludedSegments: true,
  });
  const outline = new Polyline3DElement({
    path: [...path, path[0]],
    altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
    strokeColor: "#e9ffff",
    strokeWidth: 5,
    outerColor: NEON,
    outerWidth: 1.2,
    drawsOccludedSegments: true,
  });
  neon = [fill, outline];
  map.append(fill, outline);

  const overlay = document.getElementById("overlay")!;
  overlay.querySelector(".area")!.textContent = formatArea(parcel.areaM2);
  const ada = parcel.properties.Ada ?? parcel.properties.ada;
  const parsel = parcel.properties.ParselNo ?? parcel.properties.Parsel ?? parcel.properties.parsel;
  overlay.querySelector(".sub")!.textContent = [
    parcel.properties.Nitelik,
    ada && parsel ? `${ada} Ada · ${parsel} Parsel` : undefined,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

const studio = {
  parcel: null as ParcelInfo | null,

  async load(kmlFile: string): Promise<ParcelInfo> {
    const key = import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error("GOOGLE_MAPS_API_KEY .env içinde tanımlı değil");
    status("parsel okunuyor…");
    const res = await fetch(`/api/parcel?file=${encodeURIComponent(kmlFile)}`);
    const parcel = (await res.json()) as ParcelInfo & { error?: string };
    if (parcel.error) throw new Error(parcel.error);
    this.parcel = parcel;
    status("harita yükleniyor…");
    await loadGoogleMaps(key);
    await createMap(parcel);
    await waitSteady(60000);
    status(`${formatArea(parcel.areaM2)} · rakım ${parcel.elevation?.toFixed(0) ?? "?"} m`);
    return parcel;
  },

  /** Kamerayı konumlar ve karolar tamamen yüklenene kadar bekler. */
  async setCamera(c: Camera, timeoutMs?: number): Promise<boolean> {
    map.center = { lat: c.lat, lng: c.lng, altitude: c.altitude };
    map.range = c.range;
    map.tilt = c.tilt;
    map.heading = c.heading;
    return waitSteady(timeoutMs);
  },

  /** Alan etiketi: progress 0..1 (giriş animasyonu kayıt tarafından kare kare sürülür). */
  setOverlay(progress: number) {
    const el = document.getElementById("overlay") as HTMLElement;
    const p = Math.max(0, Math.min(1, progress));
    el.style.opacity = String(p);
    el.style.transform = `translateY(${(1 - p) * 24}px) scale(${0.92 + 0.08 * p})`;
  },

  /** Neon parsel çizimini gösterir/gizler (inşaat sahnesi için temiz son kare almakta kullanılır). */
  async setNeon(visible: boolean): Promise<boolean> {
    if (visible) map.append(...neon);
    else neon.forEach((el) => el.remove());
    return waitSteady();
  },

  setChrome(visible: boolean) {
    (document.getElementById("status") as HTMLElement).style.display = visible ? "" : "none";
  },
};
(window as any).studio = studio;

// Tarayıcı önizlemesi: ?kml=... verilmişse yükle ve kamerayı parsele yaklaştır.
const kml = new URLSearchParams(location.search).get("kml");
if (kml) {
  studio
    .load(kml)
    .then(async (p) => {
      studio.setOverlay(1);
      await studio.setCamera({
        lat: p.centroid.lat,
        lng: p.centroid.lng,
        altitude: p.elevation ?? 0,
        range: Math.max(120, p.radiusM * 5),
        tilt: 55,
        heading: (p.longestEdgeHeading + 30) % 360,
      });
    })
    .catch((e) => status(`HATA: ${e.message}`));
} else if (!(window as any).__RECORDER__) {
  status("?kml=assets/parcels/<dosya>.kml parametresi verin");
}
