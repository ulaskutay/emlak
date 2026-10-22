const MAX_EDGE = 1600;

/** Fotoğrafı tarayıcıda en uzun kenarı 1600 px JPEG'e küçültür (yükleme hızlı, GPU girdisi için yeterli). */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error("Bu fotoğraf açılamadı; JPEG ya da PNG seçin");
  });
  const s = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Fotoğraf dönüştürülemedi"))), "image/jpeg", 0.88));
}

/** Fotoğrafı küçültüp yükler, R2 anahtarını döner. */
export async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", await toJpeg(file), "foto.jpg");
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Yüklenemedi");
  return data.key;
}
