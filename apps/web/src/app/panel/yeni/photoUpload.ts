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

/** Fotoğrafı küçültüp yükler; R2 anahtarı ve dikey kırpma için önerilen yatay konum. */
export async function uploadPhotoWithFocus(file: File): Promise<{ key: string; focusX: number }> {
  const fd = new FormData();
  fd.append("file", await toJpeg(file), "foto.jpg");
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Yüklenemedi");
  return { key: data.key, focusX: typeof data.focusX === "number" ? data.focusX : 0.5 };
}

/** Fotoğrafı küçültüp yükler, R2 anahtarını döner. */
export const uploadPhoto = async (file: File) => (await uploadPhotoWithFocus(file)).key;

/** Ofis logosu: saydamlık korunsun diye PNG olarak (en uzun kenar 800 px) yüklenir. R2 anahtarı ve önizleme linki. */
export async function uploadLogo(file: File): Promise<{ key: string; url: string }> {
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error("Bu logo açılamadı; PNG ya da JPEG seçin");
  });
  const s = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Logo dönüştürülemedi"))), "image/png"));
  const fd = new FormData();
  fd.append("file", blob, "logo.png");
  const r = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Yüklenemedi");
  return { key: data.key, url: data.url };
}

/** Emlakçı fotoğrafı: JPEG olarak yüklenir. R2 anahtarı ve önizleme linki. */
export async function uploadAgentPhoto(file: File): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", await toJpeg(file), "emlakci.jpg");
  const r = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Yüklenemedi");
  return { key: data.key, url: data.url };
}
