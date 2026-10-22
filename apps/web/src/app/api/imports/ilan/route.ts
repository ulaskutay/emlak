import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { r2 } from "@/lib/r2";

/**
 * İlan aktarma: "Arsa Video'ya aktar" butonu kullanıcının tarayıcısında ilan sayfasından fotoğraf linklerini toplar,
 * panel bu rotaya gönderir; fotoğraflar sahibinden'in görsel sunucusundan indirilip JPEG'e çevrilir ve kullanıcının
 * yükleme klasörüne yazılır. İlan sayfasını sunucu okuyamaz (bot doğrulaması), görsel sunucusu açıktır.
 */
const MAX_PHOTOS = 40;
const MAX_BYTES = 12_000_000;
/** Yalnız bu sunuculardan indirilir (başka adrese istek attırılamasın). */
const HOSTS = /(^|\.)(shbdn\.com|sahibinden\.com)$/;

const Body = z.object({ photos: z.array(z.string().url()).max(60) });

/** Küçük önizleme ("thmb_", "x5_"…) yerine büyük boy ("x16_") denenir, yoksa verilen link. */
function candidates(url: string) {
  const big = url.replace(/\/(?:thmb|lthmb|mthmb|x\d+)_/, "/x16_");
  return big === url ? [url] : [big, url];
}

/** Görseli en uzun kenarı 1600 px JPEG'e çevirir (webp/png de gelebilir). */
function toJpeg(input: Buffer) {
  return new Promise<Buffer>((res, rej) => {
    const out: Buffer[] = [];
    const p = spawn("ffmpeg", [
      "-v", "error", "-i", "pipe:0", "-frames:v", "1",
      "-vf", "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))'",
      "-q:v", "3", "-f", "mjpeg", "pipe:1",
    ]);
    p.stdout.on("data", (d) => out.push(d));
    p.on("error", rej);
    p.on("close", (c) => (c === 0 && out.length ? res(Buffer.concat(out)) : rej(new Error(`ffmpeg ${c}`))));
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

async function fetchPhoto(url: string) {
  for (const u of candidates(url)) {
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
    if (!res?.ok || !res.headers.get("content-type")?.startsWith("image/")) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) continue;
    return toJpeg(buf);
  }
  return null;
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Geçersiz istek");
  // Aynı fotoğrafın farklı boyları tek sayılır.
  const seen = new Set<string>();
  const urls = parsed.data.photos.filter((u) => {
    const h = new URL(u);
    if (h.protocol !== "https:" || !HOSTS.test(h.hostname)) return false;
    const id = h.pathname.replace(/\/(?:thmb|lthmb|mthmb|x\d+)_/, "/").replace(/\.\w+$/, "");
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!urls.length) return badRequest("İlanda fotoğraf bulunamadı");

  const photos: { key: string; url: string }[] = [];
  const list = urls.slice(0, MAX_PHOTOS);
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(
      list.slice(i, i + 4).map(async (u) => {
        const jpg = await fetchPhoto(u).catch(() => null);
        if (!jpg) return null;
        const key = `uploads/${user.id}/${randomUUID()}.jpg`;
        await r2().put(key, jpg, "image/jpeg");
        return { key, url: await r2().url(key, 3600) };
      }),
    );
    photos.push(...(batch.filter(Boolean) as { key: string; url: string }[]));
  }
  if (!photos.length) return badRequest("Fotoğraflar indirilemedi");
  return NextResponse.json({ photos, skipped: list.length - photos.length });
}
