import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, getDb, gte, payments } from "@arsa/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { getPricing } from "@/lib/credits";
import { paytrEnabled, paytrToken } from "@/lib/paytr";
import { site } from "@/lib/site";

const Body = z.object({
  packageId: z.string().min(1),
  phone: z
    .string()
    .transform((s) => s.replace(/[^\d+]/g, ""))
    .refine((s) => s.replace(/\D/g, "").length >= 10, "Geçerli bir telefon numarası girin"),
});

/** Cloudflare → nginx → Next: gerçek istemci adresi başlıklarda. */
function clientIp(req: Request) {
  const h = req.headers;
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

/** Kredi paketi satın alma: bekleyen ödeme kaydı açılır, PayTR iframe token'ı döner. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!paytrEnabled()) return NextResponse.json({ error: "Kartla ödeme şu an kapalı" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  const pack = (await getPricing()).packages.find((p) => p.id === parsed.data.packageId);
  if (!pack) return badRequest("Paket bulunamadı");

  const db = getDb();
  // Ödeme sayfasını art arda açıp bekleyen kayıt yığmasın.
  const [recent] = await db
    .select({ n: count() })
    .from(payments)
    .where(and(eq(payments.userId, user.id), eq(payments.status, "pending"), gte(payments.createdAt, new Date(Date.now() - 10 * 60_000))));
  if ((recent?.n ?? 0) >= 5) return NextResponse.json({ error: "Çok fazla deneme, birkaç dakika sonra tekrar deneyin" }, { status: 429 });

  const merchantOid = `AV${Date.now().toString(36)}${randomBytes(6).toString("hex")}`.toUpperCase();
  const id = randomUUID();
  await db.insert(payments).values({
    id,
    userId: user.id,
    amountTry: pack.priceTry,
    credits: pack.credits,
    method: "kart",
    status: "pending",
    merchantOid,
    packageId: pack.id,
    reference: merchantOid,
    note: `${pack.name} paketi`,
  });
  try {
    const token = await paytrToken({
      merchantOid,
      email: user.email,
      amountTry: pack.priceTry,
      basket: [{ name: `${pack.name} paketi · ${pack.credits} kredi`, priceTry: pack.priceTry, qty: 1 }],
      userIp: clientIp(req),
      userName: user.name || user.email,
      userPhone: parsed.data.phone,
      userAddress: "Türkiye",
      okUrl: `${site.url}/panel/kredi?odeme=tamam`,
      failUrl: `${site.url}/panel/kredi?odeme=hata`,
    });
    return NextResponse.json({ token });
  } catch (e) {
    console.error(`PayTR token (${merchantOid}): ${e instanceof Error ? e.message : e}`);
    await db.update(payments).set({ status: "failed", note: `${pack.name} paketi · token alınamadı` }).where(eq(payments.id, id));
    return NextResponse.json({ error: "Ödeme başlatılamadı, biraz sonra tekrar deneyin" }, { status: 502 });
  }
}
