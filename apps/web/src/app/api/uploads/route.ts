import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { r2 } from "@/lib/r2";

const MAX_BYTES = 6_000_000;

/** İlan fotoğrafı yükleme: tarayıcı JPEG'e küçültüp gönderir, R2'ye kullanıcının klasörüne yazılır. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("Fotoğraf yok");
  if (file.type !== "image/jpeg") return badRequest("Fotoğraf JPEG olmalı");
  if (file.size > MAX_BYTES) return badRequest("Fotoğraf çok büyük (en fazla 6 MB)");
  const buf = Buffer.from(await file.arrayBuffer());
  // JPEG imzası: FF D8 FF
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return badRequest("Geçersiz JPEG dosyası");
  const key = `uploads/${user.id}/${randomUUID()}.jpg`;
  await r2().put(key, buf, "image/jpeg");
  return NextResponse.json({ key, url: await r2().url(key, 3600) }, { status: 201 });
}
