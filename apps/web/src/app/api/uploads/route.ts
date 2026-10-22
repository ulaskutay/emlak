import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { autoFocus } from "@/lib/focus";
import { r2 } from "@/lib/r2";

const MAX_BYTES = 6_000_000;

/**
 * Görsel yükleme: tarayıcı küçültüp gönderir, R2'ye kullanıcının klasörüne yazılır.
 * JPEG (ilan fotoğrafı, emlakçı fotoğrafı) ya da PNG (ofis logosu: saydam arka plan JPEG'de kararıyordu).
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("Fotoğraf yok");
  const png = file.type === "image/png";
  if (file.type !== "image/jpeg" && !png) return badRequest("Görsel JPEG ya da PNG olmalı");
  if (file.size > MAX_BYTES) return badRequest("Fotoğraf çok büyük (en fazla 6 MB)");
  const buf = Buffer.from(await file.arrayBuffer());
  // İmza: JPEG FF D8 FF, PNG 89 50 4E 47
  const ok = png ? buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!ok) return badRequest(png ? "Geçersiz PNG dosyası" : "Geçersiz JPEG dosyası");
  const key = `uploads/${user.id}/${randomUUID()}.${png ? "png" : "jpg"}`;
  await r2().put(key, buf, png ? "image/png" : "image/jpeg");
  return NextResponse.json({ key, url: await r2().url(key, 3600), focusX: png ? 0.5 : await autoFocus(buf) }, { status: 201 });
}
