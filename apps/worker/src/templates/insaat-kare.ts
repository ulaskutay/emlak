/**
 * Kazı karesini birleştirme: düzenleme modelinin kazı karesinden yalnız şantiye (çıplak toprak, çukur, temel, makineler) alınır,
 * gerisi boş arsa karesinden gelir. Model (önce Qwen, şimdi Nano Banana) bina yerine çukuru doğru yere koyuyor ama bahçe/otoparkı silmiyordu.
 *
 * Maske: kazı toprağı rengi (turuncu-kırmızı) ve sarı makineler →
 * delik doldurma (toprak halkasıyla çevrili beton temel de dahil olur; halkanın dışındaki otopark olmaz) →
 * en büyük parça → yumuşak kenar.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

async function readRgb(path: string, w: number, h: number): Promise<Buffer> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", path, "-vf", `scale=${w}:${h}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout as unknown as Buffer;
}

/** Komşulukta (kare) en az bir 1 varsa 1: ikili genişletme, ayrılabilir iki geçiş. */
function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = -r; x < w; x++) {
      if (x + r < w && m[y * w + x + r]) count++;
      if (x - r - 1 >= 0 && m[y * w + x - r - 1]) count--;
      if (x >= 0) tmp[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = -r; y < h; y++) {
      if (y + r < h && tmp[(y + r) * w + x]) count++;
      if (y - r - 1 >= 0 && tmp[(y - r - 1) * w + x]) count--;
      if (y >= 0) out[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}
const erode = (m: Uint8Array, w: number, h: number, r: number) => {
  const inv = dilate(m.map((v) => 1 - v), w, h, r);
  return inv.map((v) => 1 - v);
};

/** Kenardan maskesiz piksellerle ulaşılamayan delikleri doldurur. */
function fillHoles(m: Uint8Array, w: number, h: number): Uint8Array {
  const reach = new Uint8Array(m.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!m[i] && !reach[i]) {
      reach[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return reach.map((r) => 1 - r);
}

/** En büyük bağlı parça (dağınık küçük farklar atılır). */
function largestComponent(m: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(m.length);
  let best = 0, bestSize = 0, next = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue;
    const id = ++next;
    let size = 0;
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < m.length && m[j] && !label[j]) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    if (size > bestSize) (bestSize = size), (best = id);
  }
  return Uint8Array.from(label, (l) => (l === best ? 1 : 0));
}

/** Maskeyi yumuşatır (kutu bulanıklığı, iki geçiş) → 0..1 ağırlık. */
function feather(m: Uint8Array, w: number, h: number, r: number): Float32Array {
  const a = Float32Array.from(m);
  const tmp = new Float32Array(a.length);
  const out = new Float32Array(a.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[y * w + Math.min(w - 1, Math.max(0, x + k))]!;
      tmp[y * w + x] = s / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
      out[y * w + x] = s / n;
    }
  return out;
}

export async function compositeSite(basePath: string, sitePath: string, outPath: string, w: number, h: number, maskPath?: string) {
  const [base, site] = await Promise.all([readRgb(basePath, w, h), readRgb(sitePath, w, h)]);
  const n = w * h;
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [site[i * 3]!, site[i * 3 + 1]!, site[i * 3 + 2]!];
    // Renk farkı kullanılamıyor: model kareyi baştan çizdiği için her yer başlangıçtan biraz farklı.
    const soil = r > 110 && r - g > 45 && g > b; // kazı toprağı: turuncu-kırmızı (kuru çayırda r-g ~30)
    const machine = r > 170 && g > 130 && b < 70 && r - g < 70; // sarı iş makineleri
    raw[i] = soil || machine ? 1 : 0;
  }
  // Kapama (genişlet + daralt): toprak parçalarını birleştirir, halkadaki boşlukları kapatır.
  const closed = erode(dilate(raw, w, h, 12), w, h, 12);
  const mask = largestComponent(fillHoles(closed, w, h), w, h);
  const alpha = feather(mask, w, h, 8);
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const t = alpha[i]!;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(site[i * 3 + c]! * t + base[i * 3 + c]! * (1 - t));
  }
  const write = (buf: Buffer, fmt: string, path: string) =>
    new Promise<void>((res, rej) => {
      const p = execFile("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", fmt, "-s", `${w}x${h}`, "-i", "-", path], (e) => (e ? rej(e) : res()));
      p.stdin!.end(buf);
    });
  await write(out, "rgb24", outPath);
  if (maskPath) await write(Buffer.from(mask.map((v) => v * 255)), "gray", maskPath);
}
