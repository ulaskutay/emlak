/**
 * Cesium motoru (varsayılan): Google Photorealistic 3D Tiles + CesiumJS.
 * Google'ın Map3DElement'ine göre: gökyüzü/ufuk/atmosfer, objektif (FOV) ve kamera yatışı (roll) kontrolü,
 * karo keskinliği (maximumScreenSpaceError) ve gerçek 3D efektler:
 *
 *   mahalle/parsel dolgusu  3D yüzeye "boyanır" (sınıflandırma: ağaç ve arazinin üstüne)
 *   çizgiler                yüzey yüksekliğinde; ağaç/tepe arkasında kalınca da görünür (depthFail)
 *   çit duvarı              parselin etrafında yerden yükselen ışıklı, yarı saydam duvar
 *
 * Entity'ler CallbackProperty ile her karede eşzamanlı güncellenir; settle() karolar ve geometri hazır olana kadar çizer.
 */
import { labelCanvas, makeGeometry, rgba, type Geometry, type LL, type XY } from "./geometry.js";
import { easeOut } from "./overlay.js";
import type { FrameState, ParcelInfo } from "./types.js";

const VER = "1.143";
const CDN = `https://cesium.com/downloads/cesiumjs/releases/${VER}/Build/Cesium/`;
const GOLD = "#ffc24d";
const CYAN = "#3fe0ff";

function loadCesium(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Cesium) return resolve((window as any).Cesium);
    (window as any).CESIUM_BASE_URL = CDN;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${CDN}Widgets/widgets.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${CDN}Cesium.js`;
    s.onload = () => resolve((window as any).Cesium);
    s.onerror = () => reject(new Error(`CesiumJS ${VER} yüklenemedi`));
    document.head.appendChild(s);
  });
}

/** Çit dokusu: altta parlak altın, yukarı doğru saydamlaşan dikey gradyan + ince yatay şeritler. */
function fenceTexture() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255, 210, 120, 0)");
  grad.addColorStop(0.55, "rgba(255, 194, 77, 0.22)");
  grad.addColorStop(0.92, "rgba(255, 214, 130, 0.62)");
  grad.addColorStop(1, "rgba(255, 245, 210, 0.95)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  g.fillStyle = "rgba(255, 240, 200, 0.35)";
  for (let y = 40; y < 240; y += 36) g.fillRect(0, y, 8, 2);
  return c;
}

export function cesiumEngine(opts: { sse?: number; fov?: number; msaa?: number } = {}) {
  let C: any;
  let viewer: any;
  let tileset: any;
  let parcel: ParcelInfo;
  let g: Geometry;
  let groundH = 0;
  /** Parsel içi yüzey yüksekliği: köşe + merkez örneklerinden ters mesafe ağırlıklı. */
  let heightAt: (q: XY) => number = () => groundH;
  let hoodHeights: number[] = [];
  let cur: FrameState | null = null;
  const ents: Record<string, any> = {};
  let rings: any[] = [];
  let grid: any[] = [];

  const log = (m: string) => console.log(`[cesium] ${m}`);

  /** Karolar ve entity geometrisi hazır olana kadar çiz (4 ardışık hazır kare). */
  function settle(timeoutMs = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let stable = 0;
      let errors = 0;
      const tick = () => {
        try {
          viewer.render();
        } catch (e) {
          // Geçici çizim hatası (ör. yükleme sırasında frustum): birkaç kez tekrar dene, sürerse kareyi hatalı say.
          if (++errors > 20) return resolve(false);
          console.warn(`[cesium] çizim hatası, tekrar: ${String(e).slice(0, 120)}`);
        }
        const ready = tileset.tilesLoaded && viewer.dataSourceDisplay.ready;
        stable = ready ? stable + 1 : 0;
        if (stable > 3) return resolve(true);
        if (performance.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(tick, 8);
      };
      tick();
    });
  }

  /** Yüzeye yapıştırılmış yükseklikler (render döngüsü kapalıyken örnekleme beklerken çizmek gerekir). */
  async function sampleHeights(points: LL[], timeoutMs: number): Promise<(number | undefined)[]> {
    const pump = setInterval(() => viewer.render(), 30);
    try {
      const res = await Promise.race([
        viewer.scene.clampToHeightMostDetailed(points.map((q) => C.Cartesian3.fromDegrees(q.lng, q.lat, 0))),
        new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
      ]);
      if (!res) return points.map(() => undefined);
      return (res as any[]).map((p) => (p ? C.Cartographic.fromCartesian(p).height : undefined));
    } finally {
      clearInterval(pump);
    }
  }

  const pos = (q: LL, h: number) => C.Cartesian3.fromDegrees(q.lng, q.lat, h);
  const posXY = (q: XY, dh: number) => pos(g.toLL(q), heightAt(q) + dh);
  const cb = (f: () => any) => new C.CallbackProperty(f, false);
  const color = (css: string) => C.Color.fromCssColorString(css);
  const glow = (f: () => string, power = 0.28) => new C.PolylineGlowMaterialProperty({ glowPower: power, taperPower: 1, color: cb(() => color(f())) });

  function lookAt(cam: FrameState["camera"]) {
    viewer.camera.lookAt(
      C.Cartesian3.fromDegrees(cam.lng, cam.lat, groundH),
      new C.HeadingPitchRange(C.Math.toRadians(cam.heading), -C.Math.toRadians(90 - Math.max(1, cam.tilt)), cam.range),
    );
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    if (cam.roll) viewer.camera.twistRight(C.Math.toRadians(cam.roll));
  }

  return {
    async load(p: ParcelInfo, key: string) {
      parcel = p;
      g = makeGeometry(p);
      C = await loadCesium();
      viewer = new C.Viewer(document.getElementById("map"), {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        contextOptions: { webgl: { preserveDrawingBuffer: true } },
      });
      viewer.useDefaultRenderLoop = false;
      const scene = viewer.scene;
      scene.canvas.addEventListener("webglcontextlost", () => {
        (window as any).__contextLost = true;
        console.error("[cesium] WebGL bağlamı kaybedildi");
      });
      // Çizim hatası kareyi kaybettirmesin: panel gösterme, hatayı fırlat (settle yakalar ve tekrar dener).
      viewer.cesiumWidget.showRenderLoopErrors = false;
      scene.rethrowRenderErrors = true;
      scene.globe.show = false;
      scene.skyAtmosphere.show = true;
      scene.fog.enabled = true;
      scene.msaaSamples = opts.msaa ?? 4;
      scene.postProcessStages.fxaa.enabled = true;
      viewer.camera.frustum.fov = C.Math.toRadians(opts.fov ?? 42);
      // Birden çok worker × sayfa aynı anda Google'a karo istiyor: 429 (istek sınırı) gelirse bekleyip tekrar dene;
      // yoksa karo delik kalır (zemin boş görünür). Alt karolar bu ayarları kaynaktan devralır.
      C.RequestScheduler.requestsByServer["tile.googleapis.com:443"] = 8;
      const root = new C.Resource({
        url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,
        retryAttempts: 6,
        retryCallback: (_res: unknown, err: any) =>
          new Promise<boolean>((r) => {
            const code = err?.statusCode;
            if (code && code !== 429 && code < 500) return r(false);
            setTimeout(() => r(true), 400 + Math.random() * 1200);
          }),
      });
      tileset = await C.Cesium3DTileset.fromUrl(root, {
        showCreditsOnScreen: true,
        maximumScreenSpaceError: opts.sse ?? 4,
        // Ufka bakan alçak planlarda uzak karolar düşük detayla (sis zaten örter): yükleme ve bellek düşer.
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 2.0e-4,
        dynamicScreenSpaceErrorFactor: 24,
        // Paralel sayfalar (her biri ayrı Cesium) GPU belleğini paylaşır: önbellek sınırlı.
        cacheBytes: 256 * 1024 * 1024,
        maximumCacheOverflowBytes: 128 * 1024 * 1024,
      });
      scene.primitives.add(tileset);
      log("tileset eklendi");

      // Yüzey yükseklikleri (Google karoları elipsoid yüksekliğinde; Türkiye'de deniz seviyesinden ~35–40 m fazla).
      const cpos = p.centroid;
      lookAt({ lat: cpos.lat, lng: cpos.lng, altitude: 0, range: Math.max(400, p.radiusM * 8), tilt: 30, heading: 0 } as any);
      log(`parsel karoları: ${await settle(60000)}`);
      const hs = await sampleHeights([cpos, ...p.ring], 30000);
      groundH = hs[0] ?? (p.elevation ?? 0) + 37;
      const samples = [{ q: { x: 0, y: 0 }, h: groundH }, ...p.ring.map((q, i) => ({ q: g.toXY(q), h: hs[i + 1] ?? groundH }))];
      heightAt = (q) => {
        let w = 0;
        let s = 0;
        for (const smp of samples) {
          const d2 = (smp.q.x - q.x) ** 2 + (smp.q.y - q.y) ** 2 + 1;
          s += smp.h / d2;
          w += 1 / d2;
        }
        return s / w;
      };
      log(`zemin ${groundH.toFixed(1)} m`);

      if (p.hood?.ring.length) {
        // Mahalle sınırı yükseklikleri: bölge planına bakıp karoları yükledikten sonra örnekle.
        const lats = p.hood.ring.map((q) => q.lat);
        const lngs = p.hood.ring.map((q) => q.lng);
        const ctr = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
        const span = Math.max((Math.max(...lats) - Math.min(...lats)) * 111_320, (Math.max(...lngs) - Math.min(...lngs)) * 85_000);
        lookAt({ ...ctr, altitude: 0, range: span * 2.2, tilt: 15, heading: 0 } as any);
        await settle(45000);
        hoodHeights = (await sampleHeights(p.hood.ring, 45000)).map((h) => h ?? groundH);
        log(`mahalle sınırı yükseklikleri: ${hoodHeights.filter((h) => h !== groundH).length}/${hoodHeights.length}`);
      }

      const E = viewer.entities;
      const tile = C.ClassificationType.CESIUM_3D_TILE;
      // Parsel dolgusu ve kontur
      ents.fill = E.add({
        polygon: { hierarchy: p.ring.map((q) => pos(q, 0)), classificationType: tile, material: new C.ColorMaterialProperty(cb(() => color(rgba(GOLD, 0.3 * (cur?.fill ?? 0))))) },
      });
      ents.outline = E.add({
        polyline: {
          positions: cb(() => g.parcelPath(cur && cur.neon > 0 ? easeOut(cur.neon) : 0).map((q) => posXY(g.toXY(q), 1.8))),
          width: 14,
          material: glow(() => GOLD, 0.3),
          depthFailMaterial: glow(() => rgba(GOLD, 0.55), 0.3),
        },
      });
      // Mahalle sınırı
      if (p.hood?.ring.length && g.hoodPath) {
        const hood = p.hood.ring;
        ents.hoodFill = E.add({
          polygon: { hierarchy: hood.map((q) => pos(q, 0)), classificationType: tile, material: new C.ColorMaterialProperty(cb(() => color(rgba(CYAN, 0.16 * (cur?.hood?.fill ?? 0) * (cur?.hood?.opacity ?? 0))))) },
        });
        // Kısmi çizimde her noktanın yüksekliği: en yakın sınır köşesininki.
        const hAt = (q: LL) => {
          let best = 0;
          let bd = Infinity;
          hood.forEach((v, i) => {
            const d = (v.lat - q.lat) ** 2 + (v.lng - q.lng) ** 2;
            if (d < bd) (bd = d), (best = i);
          });
          return hoodHeights[best] ?? groundH;
        };
        ents.hoodLine = E.add({
          polyline: {
            positions: cb(() => g.hoodPath!(cur?.hood?.draw ?? 0).map((q) => pos(q, hAt(q) + 6))),
            width: 11,
            material: glow(() => rgba(CYAN, cur?.hood?.opacity ?? 0), 0.32),
            depthFailMaterial: glow(() => rgba(CYAN, 0.6 * (cur?.hood?.opacity ?? 0)), 0.32),
          },
        });
      }
      // Pin + dalga halkaları
      ents.pin = E.add({
        position: cb(() => pos(parcel.centroid, groundH + (1 - (cur?.pin?.drop ?? 1)) * (cur?.camera.range ?? 1000) * 0.45)),
        billboard: { image: labelCanvas("📍 ARSA", GOLD, { size: 44, stem: 46 }), verticalOrigin: C.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
      rings = [0, 1, 2].map((k) => {
        const phase = () => (cur?.pin?.pulse ?? 0) - k / 3;
        const f = () => ((phase() % 1) + 1) % 1;
        return E.add({
          polyline: {
            positions: cb(() => {
              const base = Math.max(parcel.radiusM * 1.3, (cur?.camera.range ?? 1000) * 0.025);
              return g.circle(base * (1 + 5 * f())).map((q) => pos(q, groundH + 4));
            }),
            width: 8,
            material: glow(() => rgba(GOLD, 0.9 * (1 - f())), 0.25),
            depthFailMaterial: glow(() => rgba(GOLD, 0.6 * (1 - f())), 0.25),
          },
        });
      });
      // Tarama: taranan bölge, tarama çizgisi, ızgara
      let scanCache: { p: number; f: ReturnType<Geometry["scanFrame"]> } | null = null;
      const scanF = () => {
        const sp = cur?.scan?.progress ?? 0;
        if (!scanCache || scanCache.p !== sp) scanCache = { p: sp, f: g.scanFrame(sp) };
        return scanCache.f;
      };
      ents.scanFill = E.add({
        polygon: {
          hierarchy: cb(() => new C.PolygonHierarchy((scanF().scanned.length ? scanF().scanned : g.ringXY).map((q) => posXY(q, 1.6)))),
          perPositionHeight: true,
          material: new C.ColorMaterialProperty(cb(() => color(rgba(GOLD, scanF().scanned.length ? 0.32 * (cur?.scan?.grid ?? 0) : 0)))),
        },
      });
      ents.scanLine = E.add({
        polyline: {
          positions: cb(() => (scanF().line ?? [g.ringXY[0]!, g.ringXY[0]!]).map((q) => posXY(q, 2.5))),
          width: 18,
          material: glow(() => rgba(CYAN, cur?.scan?.line ?? 0), 0.35),
          depthFailMaterial: glow(() => rgba(CYAN, 0.8 * (cur?.scan?.line ?? 0)), 0.35),
        },
      });
      grid = Array.from({ length: g.gridMax }, (_, i) =>
        E.add({
          polyline: {
            positions: cb(() => (scanF().grid[i] ?? [g.ringXY[0]!, g.ringXY[0]!]).map((q) => posXY(q, 2))),
            width: 2.5,
            material: new C.ColorMaterialProperty(cb(() => color(rgba("#ffecbe", 0.8 * (cur?.scan?.grid ?? 0))))),
            depthFailMaterial: new C.ColorMaterialProperty(cb(() => color(rgba("#ffecbe", 0.5 * (cur?.scan?.grid ?? 0))))),
          },
        }),
      );
      // Çit duvarı: yerden yükselir, üst kenarında parlak çizgi.
      const fenceH = Math.min(30, Math.max(9, p.radiusM * 0.22));
      const ringClosed = [...g.ringXY, g.ringXY[0]!];
      const fenceTop = () => fenceH * easeOut(cur?.fence ?? 0);
      ents.fence = E.add({
        wall: {
          positions: ringClosed.map((q) => posXY(q, 0)),
          minimumHeights: ringClosed.map((q) => heightAt(q) - 1),
          maximumHeights: cb(() => ringClosed.map((q) => heightAt(q) + Math.max(0.5, fenceTop()))),
          material: new C.ImageMaterialProperty({ image: fenceTexture(), transparent: true, color: cb(() => C.Color.WHITE.withAlpha(Math.min(1, (cur?.fence ?? 0) * 1.5))) }),
        },
      });
      ents.fenceTop = E.add({
        polyline: {
          positions: cb(() => ringClosed.map((q) => posXY(q, fenceTop()))),
          width: 7,
          material: glow(() => rgba(GOLD, cur?.fence ?? 0), 0.3),
        },
      });

      log(`hazır: ${await settle(60000)}`);
      return `${parcel.hood?.name ?? "mahalle sınırı yok"} · zemin ${groundH.toFixed(0)} m (elipsoid)`;
    },

    async render(s: FrameState, timeoutMs = 30000) {
      cur = s;
      lookAt(s.camera);
      const show = (e: any, on: boolean) => e && (e.show = on);
      show(ents.hoodLine, !!s.hood && s.hood.draw > 0 && s.hood.opacity > 0);
      show(ents.hoodFill, !!s.hood && s.hood.fill > 0 && s.hood.opacity > 0);
      const pinOn = !!s.pin && s.pin.opacity > 0;
      show(ents.pin, pinOn);
      rings.forEach((r, k) => show(r, pinOn && (s.pin?.drop ?? 0) >= 1 && (s.pin?.pulse ?? 0) - k / 3 >= 0));
      show(ents.scanFill, !!s.scan);
      show(ents.scanLine, !!s.scan && s.scan.line > 0.02);
      const nGrid = s.scan && s.scan.grid > 0.02 ? g.scanFrame(s.scan.progress).grid.length : 0;
      grid.forEach((e, i) => show(e, i < nGrid));
      show(ents.fence, (s.fence ?? 0) > 0.01);
      show(ents.fenceTop, (s.fence ?? 0) > 0.01);
      show(ents.outline, s.neon > 0);
      return settle(timeoutMs);
    },

    async clean(keepNeon: boolean) {
      for (const e of viewer.entities.values) e.show = keepNeon && (e === ents.outline || e === ents.fill);
      return settle();
    },
  };
}
