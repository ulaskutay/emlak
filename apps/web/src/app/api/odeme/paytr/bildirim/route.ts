import { addCredits, and, eq, getDb, lockUserCredits, payments } from "@arsa/db";
import { verifyPaytrCallback } from "@/lib/paytr";

/**
 * PayTR bildirim adresi (mağaza panelinde Bildirim URL: /api/odeme/paytr/bildirim).
 * PayTR "OK" yanıtı görene kadar aynı bildirimi tekrar gönderir; bu yüzden işlem bir kez yapılır, yanıt her seferinde OK.
 */
export async function POST(req: Request) {
  const cb = verifyPaytrCallback(await req.formData());
  if (!cb) return new Response("PAYTR notification failed: bad hash", { status: 400 });

  const db = getDb();
  const [p] = await db.select().from(payments).where(eq(payments.merchantOid, cb.merchantOid));
  if (!p) {
    console.error(`PayTR bildirimi: bilinmeyen sipariş ${cb.merchantOid}`);
    return new Response("OK");
  }
  await db.transaction(async (tx) => {
    await lockUserCredits(tx, p.userId);
    // Yalnız bekleyen ödeme değişir: tekrar gelen bildirim krediyi ikinci kez vermez.
    const note = [p.note, cb.testMode ? "test" : null, cb.status === "failed" ? cb.failedReason : null].filter(Boolean).join(" · ");
    const [updated] = await tx
      .update(payments)
      .set({ status: cb.status === "success" ? "paid" : "failed", note })
      .where(and(eq(payments.id, p.id), eq(payments.status, "pending")))
      .returning({ id: payments.id });
    if (updated && cb.status === "success")
      await addCredits(tx, { userId: p.userId, delta: p.credits, reason: "purchase", paymentId: p.id, note: `Kartla ödeme · ${cb.totalAmount ? Number(cb.totalAmount) / 100 : p.amountTry} ₺` });
  });
  return new Response("OK");
}
