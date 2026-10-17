/**
 * Denize uzaklık. Üç kaynak, en doğrusundan başlayarak:
 *   1. Google Static Maps "su maskesi": su mavi, geri kalan beyaz çizilen harita görüntüsünde parsel merkezine en yakın
 *      büyük su alanı (yakın planda piksel ~2 m). Gölet/dere gibi küçük alanlar ve deniz seviyesinden yüksek göller
 *      elenir. Anahtarda Maps Static API açık olmalı.
 *   2. Yükseklik verisi, Copernicus DEM 90 m (Open-Meteo, anahtarsız; yoğunlukta 429/aşırı yük verebilir).
 *   3. Google Elevation (çözünürlüğü kırsalda ~600 m: kıyıyı biraz uzakta bulur, son çare).
 * Yükseklikte: parselden 16 yöne ışın, 50 m'den 15 km'ye artan adımlar; ardışık iki "deniz" örneğinin ilki kıyı
 * sayılır (tek noktalık çukur yanılgısı olmasın), en yakın ışın ince adımlarla netleştirilir.
 */
import type { LatLng } from "./kml.js";
import { poiCategoryInfo, type Poi } from "./pois.js";

const BEARINGS = 16;
const MAX_M = 15_000;
/** 50 m'den başlayıp %35 artan adımlar (yakında sık, uzakta seyrek); 16 yön × 20 adım = 320 nokta. */
const STEPS = (() => {
  const s: number[] = [];
  for (let d = 50; d <= MAX_M; d *= 1.35) s.push(Math.round(d));
  return s;
})();

function destination(o: LatLng, bearingDeg: number, m: number): LatLng {
  const b = (bearingDeg * Math.PI) / 180;
  return { lat: o.lat + (m * Math.cos(b)) / 111_320, lng: o.lng + (m * Math.sin(b)) / (111_320 * Math.cos((o.lat * Math.PI) / 180)) };
}

const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function googleElevations(points: LatLng[], key: string): Promise<number[]> {
  const parts = await Promise.all(
    chunks(points, 200).map(async (c) => {
      const loc = c.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|");
      const res = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${loc}&key=${key}`, { signal: AbortSignal.timeout(15_000) });
      const j = (await res.json()) as { status: string; error_message?: string; results?: { elevation: number }[] };
      if (j.status !== "OK" || j.results?.length !== c.length) throw new Error(`Google Elevation ${j.status}: ${j.error_message ?? ""}`);
      return j.results.map((r) => r.elevation);
    }),
  );
  return parts.flat();
}

/** Anahtarsız servis dakikalık sınır uyguluyor (429): istekler sırayla, 429'da bekleyip yeniden. */
async function openMeteoElevations(points: LatLng[]): Promise<number[]> {
  const out: number[] = [];
  for (const c of chunks(points, 100)) {
    const lat = c.map((p) => p.lat.toFixed(5)).join(",");
    const lng = c.map((p) => p.lng.toFixed(5)).join(",");
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Open-Meteo yükseklik ${res.status}`);
      const j = (await res.json()) as { elevation?: number[] };
      if (j.elevation?.length !== c.length) throw new Error("Open-Meteo yükseklik: eksik yanıt");
      out.push(...j.elevation);
      break;
    }
  }
  return out;
}

/** Önce Copernicus 90 m (kıyıda daha doğru), olmazsa Google Elevation. */
async function elevations(points: LatLng[], googleKey?: string): Promise<{ values: number[]; source: "google" | "dem" }> {
  try {
    return { values: await openMeteoElevations(points), source: "dem" };
  } catch (e) {
    if (!googleKey) throw e;
    return { values: await googleElevations(points, googleKey), source: "google" };
  }
}

/** zlib akışını açar (web standardı: Node ve tarayıcıda aynı; paket tarayıcıda da kullanılıyor). */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 8 bit RGBA/RGB, taramasız PNG'yi çözer (Static Maps png32). Piksel başına [r, g, b]. */
async function decodePng(buf: Uint8Array): Promise<{ width: number; height: number; rgb: (x: number, y: number) => [number, number, number] }> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o: number) => view.getUint32(o);
  const ascii = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (u32(0) !== 0x89504e47) throw new Error("PNG değil");
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Uint8Array[] = [];
  while (pos < buf.length) {
    const len = u32(pos);
    const type = ascii(pos + 4);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = u32(pos + 8);
      height = u32(pos + 12);
      const [depth, color, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== 8 || interlace !== 0 || (color !== 6 && color !== 2)) throw new Error(`desteklenmeyen PNG (derinlik ${depth}, renk ${color})`);
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  idat.reduce((o, d) => (joined.set(d, o), o + d.length), 0);
  const raw = await inflate(joined);
  const stride = width * channels;
  const px = new Uint8Array(height * stride);
  // Satır filtreleri: 0 yok, 1 sol, 2 üst, 3 ortalama, 4 Paeth.
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[dst + i - channels]! : 0;
      const b = y > 0 ? px[dst - stride + i]! : 0;
      const c = y > 0 && i >= channels ? px[dst - stride + i - channels]! : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const add = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pr;
      px[dst + i] = (raw[src + i]! + add) & 0xff;
    }
  }
  return { width, height, rgb: (x, y) => [px[y * stride + x * channels]!, px[y * stride + x * channels + 1]!, px[y * stride + x * channels + 2]!] };
}

/**
 * Google Static Maps su maskesi: yakından uzağa üç yakınlık (±0,6 / ±2,3 / ±9 km), suyu ilk gördüğü planda en yakın
 * mavi piksel. Anahtarda Maps Static API kapalıysa hata (yükseklik verisine düşülür).
 */
async function staticMapWater(origin: LatLng, key: string): Promise<{ distanceM: number; position: LatLng } | null> {
  const style = ["feature:all|element:labels|visibility:off", "feature:all|element:geometry|color:0xffffff", "feature:water|element:geometry|color:0x0000ff"]
    .map((s) => `&style=${encodeURIComponent(s)}`)
    .join("");
  for (const zoom of [16, 14, 12]) {
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${origin.lat},${origin.lng}&zoom=${zoom}&size=640x640&scale=1&format=png32${style}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Google Static Maps ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const img = await decodePng(new Uint8Array(await res.arrayBuffer()));
    const W = img.width;
    const H = img.height;
    const water = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [r, g, b] = img.rgb(x, y);
        water[y * W + x] = b >= 200 && r <= 80 && g <= 80 ? 1 : 0; // su: saf mavi (kenar yumuşatması dahil)
      }
    // Bağlantılı su alanları; gölet/havuz/dere gibi küçükler (görüntünün %1'inden az) deniz sayılmaz.
    const label = new Int32Array(W * H).fill(-1);
    const regions: { size: number; nearest: { d2: number; x: number; y: number }; open: { d2: number; x: number; y: number } }[] = [];
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < W * H; i++) {
      if (!water[i] || label[i] !== -1) continue;
      const id = regions.length;
      const reg = { size: 0, nearest: { d2: Infinity, x: 0, y: 0 }, open: { d2: -1, x: 0, y: 0 } };
      const stack = [i];
      label[i] = id;
      while (stack.length) {
        const j = stack.pop()!;
        const x = j % W;
        const y = (j - x) / W;
        reg.size++;
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 < reg.nearest.d2) reg.nearest = { d2, x, y };
        if (d2 > reg.open.d2) reg.open = { d2, x, y };
        for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1])
          if (k >= 0 && water[k] && label[k] === -1) (label[k] = id), stack.push(k);
      }
      regions.push(reg);
    }
    // Web Mercator: metre/piksel = 156543,03 × cos(enlem) / 2^zoom.
    const k = Math.cos((origin.lat * Math.PI) / 180);
    const mpp = (156_543.03 * k) / 2 ** zoom;
    const toPoint = (x: number, y: number) => {
      const east = (x - cx) * mpp;
      const north = (cy - y) * mpp;
      return { distanceM: Math.hypot(east, north), position: { lat: origin.lat + north / 111_320, lng: origin.lng + east / (111_320 * k) } };
    };
    const big = regions.filter((r) => r.size >= W * H * 0.01).sort((a, b) => a.nearest.d2 - b.nearest.d2);
    if (!big.length) continue;
    // Göl değil deniz: alanın açık su noktası (merkezden en uzak su pikseli; kıyıda yükseklik çözünürlüğü kaba)
    // deniz seviyesinde ya da altında olmalı. Yükseklik alınamazsa kabul edilir.
    const cands = big.slice(0, 3);
    const level = await googleElevations(
      cands.map((r) => toPoint(r.open.x, r.open.y).position),
      key,
    ).catch(() => null);
    const sea = cands.find((_, i) => !level || level[i]! <= 3);
    if (sea) return toPoint(sea.nearest.x, sea.nearest.y);
  }
  return null;
}

/** Denize yakın değilse (15 km içinde kıyı yok) null. */
export async function seaDistance(origin: LatLng, googleKey?: string): Promise<Poi | null> {
  const info = poiCategoryInfo("sea");
  if (googleKey) {
    try {
      const w = await staticMapWater(origin, googleKey);
      return w ? { category: "sea", label: info.label, emoji: info.emoji, position: w.position, distanceM: w.distanceM, source: "google" } : null;
    } catch {
      // Static Maps kapalı: yükseklik verisine düş
    }
  }
  return seaFromElevation(origin, googleKey);
}

async function seaFromElevation(origin: LatLng, googleKey?: string): Promise<Poi | null> {
  const rays = Array.from({ length: BEARINGS }, (_, i) => (i * 360) / BEARINGS);
  const coarse = await elevations(rays.flatMap((b) => STEPS.map((d) => destination(origin, b, d))), googleKey);
  const isSea = (e: number) => e <= 0;

  // Her ışında kıyı: ardışık iki deniz örneğinin ilki.
  let best: { bearing: number; i: number } | null = null;
  rays.forEach((bearing, r) => {
    const e = coarse.values.slice(r * STEPS.length, (r + 1) * STEPS.length);
    const i = e.findIndex((v, k) => isSea(v) && (k + 1 >= e.length || isSea(e[k + 1]!)));
    if (i >= 0 && (!best || STEPS[i]! < STEPS[best.i]!)) best = { bearing, i };
  });
  if (!best) return null;
  const { bearing, i } = best as { bearing: number; i: number };

  // Netleştirme: son kara örneği ile ilk deniz örneği arasında 10 adım.
  const from = i === 0 ? 0 : STEPS[i - 1]!;
  const to = STEPS[i]!;
  const fine = Array.from({ length: 10 }, (_, k) => from + ((to - from) * (k + 1)) / 10);
  const fe = await elevations(fine.map((d) => destination(origin, bearing, d)), googleKey).catch(() => null);
  const k = fe ? fe.values.findIndex(isSea) : -1;
  const d = k >= 0 ? fine[k]! : to;
  const info = poiCategoryInfo("sea");
  return { category: "sea", label: info.label, emoji: info.emoji, position: destination(origin, bearing, d), distanceM: d, source: coarse.source };
}
