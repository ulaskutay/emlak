/**
 * Fotoğraf iyileştirme (sunucuda, GPU'suz): Real-ESRGAN realesr-general-x4v3 (gürültü giderme 0,5 karışımı, ONNX) ilan
 * fotoğraflarındaki JPEG bozulmasını temizleyip 4 kat büyütür; sonuç istenen boyuta küçültülür. Görüntü döşemeler
 * (tile) halinde işlenir, döşeme kenarları payla kesilir ki dikiş izi kalmasın.
 *
 * Model: apps/worker/models (BSD-3, xinntao/Real-ESRGAN v0.2.5.0 ağırlıkları).
 */
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

const MODEL = fileURLToPath(new URL("../../models/realesr-general-x4v3.onnx", import.meta.url));
const SCALE = 4;
const TILE = 256;
const PAD = 12;

let session: Promise<ort.InferenceSession> | null = null;
const getSession = () =>
  (session ??= ort.InferenceSession.create(MODEL, { intraOpNumThreads: cpus().length, graphOptimizationLevel: "all" }).catch((e) => {
    session = null;
    throw e;
  }));

/** RGB (uint8, HWC) görüntüyü 4 kat büyütür. */
async function upscaleRgb(src: Buffer, w: number, h: number, onTile?: (done: number, total: number) => void) {
  const s = await getSession();
  const W = w * SCALE;
  const out = Buffer.alloc(W * h * SCALE * 3);
  const tiles: [number, number][] = [];
  for (let y = 0; y < h; y += TILE) for (let x = 0; x < w; x += TILE) tiles.push([x, y]);
  let done = 0;
  for (const [x0, y0] of tiles) {
    const x1 = Math.min(x0 + TILE, w);
    const y1 = Math.min(y0 + TILE, h);
    // Paylı döşeme: model kenarda bağlamsız kalmasın.
    const px0 = Math.max(0, x0 - PAD);
    const py0 = Math.max(0, y0 - PAD);
    const px1 = Math.min(w, x1 + PAD);
    const py1 = Math.min(h, y1 + PAD);
    const tw = px1 - px0;
    const th = py1 - py0;
    const plane = tw * th;
    const input = new Float32Array(3 * plane);
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const i = ((py0 + y) * w + px0 + x) * 3;
        const j = y * tw + x;
        input[j] = src[i]! / 255;
        input[plane + j] = src[i + 1]! / 255;
        input[2 * plane + j] = src[i + 2]! / 255;
      }
    const res = await s.run({ input: new ort.Tensor("float32", input, [1, 3, th, tw]) });
    const o = res.output!.data as Float32Array;
    const ow = tw * SCALE;
    const oplane = ow * th * SCALE;
    // Paysız iç bölge çıktıya yazılır.
    for (let y = (y0 - py0) * SCALE; y < (y1 - py0) * SCALE; y++)
      for (let x = (x0 - px0) * SCALE; x < (x1 - px0) * SCALE; x++) {
        const j = y * ow + x;
        const k = ((py0 * SCALE + y) * W + px0 * SCALE + x) * 3;
        out[k] = Math.max(0, Math.min(255, Math.round(o[j]! * 255)));
        out[k + 1] = Math.max(0, Math.min(255, Math.round(o[oplane + j]! * 255)));
        out[k + 2] = Math.max(0, Math.min(255, Math.round(o[2 * oplane + j]! * 255)));
      }
    onTile?.(++done, tiles.length);
  }
  return { data: out, width: W, height: h * SCALE };
}

/**
 * Fotoğrafı iyileştirip `fit` kutusuna sığacak boyda JPEG yazar. Kısa kenarı minSide'dan büyük fotoğraflar
 * (zaten yeterince net) modele girmez, yalnız küçültülür.
 */
export async function enhancePhoto(
  input: string,
  out: string,
  o: { fit: { width: number; height: number }; minSide?: number; onProgress?: (p: number) => void },
) {
  const { data, info } = await sharp(input).rotate().removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const big = Math.min(info.width, info.height) >= (o.minSide ?? 1800);
  const img = big
    ? sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    : await upscaleRgb(data, info.width, info.height, (d, t) => o.onProgress?.(d / t)).then((r) =>
        sharp(r.data, { raw: { width: r.width, height: r.height, channels: 3 } }),
      );
  const res = await img
    .resize({ ...o.fit, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(out);
  return { file: out, width: res.width, height: res.height, enhanced: !big };
}
