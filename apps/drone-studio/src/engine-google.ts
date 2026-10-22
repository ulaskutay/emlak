/**
 * Google Maps JS 3D motoru (Map3DElement): karşılaştırma ve yedek için (?engine=google).
 * Kamerada yatış (roll), objektif ve atmosfer kontrolü yok; varsayılan motor Cesium (engine-cesium.ts).
 */
import { formatArea } from "@arsa/geo";
import { labelCanvas, makeGeometry, rgba, type Geometry, type LL } from "./geometry.js";
import { easeOut } from "./overlay.js";
import type { FrameState, ParcelInfo } from "./types.js";

const GOLD = "#ffc24d";
const CYAN = "#3fe0ff";

async function loadGoogleMaps(key: string): Promise<void> {
  if ((window as any).google?.maps?.importLibrary) return;
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => reject(new Error("Google Maps JS 45 sn içinde yüklenmedi")), 45000);
    const cb = `__gmapsReady${Date.now()}`;
    (window as any)[cb] = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=beta&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps JS yüklenemedi"));
    document.head.appendChild(s);
  });
}

function template(canvas: HTMLCanvasElement) {
  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/png");
  img.width = canvas.width;
  img.height = canvas.height;
  const tpl = document.createElement("template");
  tpl.content.append(img);
  return tpl;
}

export function googleEngine() {
  let lib: any;
  let map: any;
  let parcel: ParcelInfo;
  let g: Geometry;
  let fillEl: any, outlineEl: any, hoodLineEl: any, hoodFillEl: any, pinEl: any, scanLineEl: any, scanFillEl: any;
  let ringEls: any[] = [];
  let gridEls: any[] = [];
  const shown = new Set<any>();
  let steady = false;
  const steadyWaiters: (() => void)[] = [];

  function waitSteady(timeoutMs = 20000): Promise<boolean> {
    return new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (steady) setTimeout(() => (steady ? resolve(true) : steadyWaiters.push(() => resolve(true))), 120);
          else steadyWaiters.push(() => resolve(true));
        }),
      );
      setTimeout(() => resolve(false), timeoutMs);
    });
  }
  const at = (q: LL, altitude: number) => ({ lat: q.lat, lng: q.lng, altitude });
  const toggle = (el: any, visible: boolean) => {
    if (!el) return;
    if (visible && !shown.has(el)) (map.append(el), shown.add(el));
    else if (!visible && shown.has(el)) (el.remove(), shown.delete(el));
  };
  const glowLine = (o: { color: string; core?: string; width: number; outer?: number; mode?: string }) =>
    new lib.Polyline3DElement({
      path: [at(parcel.centroid, 1), at(parcel.centroid, 1)],
      altitudeMode: lib.AltitudeMode[o.mode ?? "RELATIVE_TO_MESH"],
      strokeColor: o.core ?? "#fffaf0",
      strokeWidth: o.width,
      outerColor: o.color,
      outerWidth: o.outer ?? 0.6,
      drawsOccludedSegments: true,
    });

  return {
    async load(p: ParcelInfo, key: string) {
      parcel = p;
      g = makeGeometry(p);
      await loadGoogleMaps(key);
      lib = await (window as any).google.maps.importLibrary("maps3d");
      const { Map3DElement, Polygon3DElement, Marker3DElement, MapMode, AltitudeMode } = lib;
      map = new Map3DElement({
        center: at(p.centroid, p.elevation ?? 0),
        range: Math.max(1500, p.radiusM * 30),
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

      const poly = (path: LL[], alt: number, mode = "RELATIVE_TO_MESH") =>
        new Polygon3DElement({ path: path.map((q) => at(q, alt)), altitudeMode: AltitudeMode[mode], fillColor: "rgba(0,0,0,0)", strokeColor: "rgba(0,0,0,0)", strokeWidth: 0, drawsOccludedSegments: true });
      fillEl = poly(p.ring, 1.5);
      outlineEl = glowLine({ color: GOLD, width: 16, outer: 0.62 });
      map.append(fillEl, outlineEl);
      if (p.hood?.ring.length) {
        hoodFillEl = poly(p.hood.ring, 4, "RELATIVE_TO_GROUND");
        hoodLineEl = glowLine({ color: CYAN, core: "#effcff", width: 12, outer: 0.65, mode: "RELATIVE_TO_GROUND" });
      }
      pinEl = new Marker3DElement({ position: at(p.centroid, 0), altitudeMode: AltitudeMode.RELATIVE_TO_GROUND, sizePreserved: true, drawsWhenOccluded: true });
      pinEl.append(template(labelCanvas("📍 ARSA", GOLD, { size: 44, stem: 46 })));
      ringEls = [0, 1, 2].map(() => glowLine({ color: GOLD, core: "#fff3d6", width: 7, outer: 0.5, mode: "RELATIVE_TO_GROUND" }));
      scanFillEl = poly(p.ring, 1.6);
      scanLineEl = glowLine({ color: CYAN, core: "#ffffff", width: 18, outer: 0.7 });
      gridEls = Array.from({ length: g.gridMax }, () =>
        new lib.Polyline3DElement({ path: [at(p.centroid, 1), at(p.centroid, 1)], altitudeMode: AltitudeMode.RELATIVE_TO_MESH, strokeColor: "rgba(255,236,190,.75)", strokeWidth: 3, drawsOccludedSegments: true }),
      );
      await waitSteady(60000);
      return `${formatArea(p.areaM2)} · ${p.hood?.name ?? "mahalle sınırı yok"}`;
    },

    async render(s: FrameState, timeoutMs?: number) {
      const c = s.camera;
      map.center = at(c, c.altitude);
      map.range = c.range;
      map.tilt = c.tilt;
      map.heading = c.heading;
      if (map.mode !== lib.MapMode[s.mode]) map.mode = lib.MapMode[s.mode];
      outlineEl.path = g.parcelPath(s.neon <= 0 ? 0 : easeOut(s.neon)).map((q) => at(q, 1.5));
      fillEl.fillColor = rgba(GOLD, 0.22 * s.fill);

      const h = s.hood;
      toggle(hoodLineEl, !!h && h.draw > 0 && h.opacity > 0);
      toggle(hoodFillEl, !!h && h.fill > 0 && h.opacity > 0);
      if (h && g.hoodPath) {
        hoodLineEl.path = g.hoodPath(h.draw).map((q) => at(q, 4));
        hoodLineEl.outerColor = rgba(CYAN, 0.95 * h.opacity);
        hoodLineEl.strokeColor = rgba("#effcff", h.opacity);
        if (hoodFillEl) hoodFillEl.fillColor = rgba(CYAN, 0.13 * h.fill * h.opacity);
      }

      const pin = s.pin;
      const pinOn = !!pin && pin.opacity > 0;
      toggle(pinEl, pinOn);
      if (pin && pinOn) {
        pinEl.position = at(parcel.centroid, (1 - pin.drop) * c.range * 0.45);
        const base = Math.max(parcel.radiusM * 1.3, c.range * 0.025);
        ringEls.forEach((el, k) => {
          const phase = pin.pulse - k / ringEls.length;
          const on = pin.drop >= 1 && phase >= 0;
          toggle(el, on);
          if (!on) return;
          const f = phase % 1;
          el.path = g.circle(base * (1 + 5 * f)).map((q) => at(q, 3));
          el.outerColor = rgba(GOLD, 0.85 * (1 - f));
          el.strokeColor = rgba("#fff3d6", 0.9 * (1 - f));
        });
      } else ringEls.forEach((el) => toggle(el, false));

      const sc = s.scan;
      toggle(scanFillEl, !!sc);
      if (sc) {
        const f = g.scanFrame(sc.progress);
        if (f.scanned.length) scanFillEl.path = f.scanned.map((q) => at(g.toLL(q), 1.6));
        scanFillEl.fillColor = rgba(GOLD, f.scanned.length ? 0.3 * sc.grid : 0);
        toggle(scanLineEl, sc.line > 0.02 && !!f.line);
        if (f.line) scanLineEl.path = f.line.map((q) => at(g.toLL(q), 2.2));
        scanLineEl.outerColor = rgba(CYAN, 0.9 * sc.line);
        scanLineEl.strokeColor = rgba("#ffffff", sc.line);
        gridEls.forEach((el, i) => {
          const seg = f.grid[i];
          toggle(el, !!seg && sc.grid > 0.02);
          if (seg) (el.path = seg.map((q) => at(g.toLL(q), 1.7))), (el.strokeColor = rgba("#ffecbe", 0.7 * sc.grid));
        });
      } else [scanLineEl, ...gridEls].forEach((el) => toggle(el, false));
      return waitSteady(timeoutMs);
    },

    async clean(keepNeon: boolean) {
      [...shown].forEach((el) => el !== fillEl && el !== outlineEl && (el.remove(), shown.delete(el)));
      if (map.mode !== lib.MapMode.SATELLITE) map.mode = lib.MapMode.SATELLITE;
      if (!keepNeon) [fillEl, outlineEl].forEach((el) => el.remove());
      return waitSteady();
    },
  };
}
