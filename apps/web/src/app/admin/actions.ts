"use server";
import { randomUUID } from "node:crypto";
import { and, appSettings, eq, inArray, getDb, payments, rechargeVideoCredits, refundVideoCredits, session, user, videos, type PaymentMethod, type PaymentStatus } from "@arsa/db";
import { mergePricing, type CreditPackage } from "@arsa/shared";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { addCredits, PRICING_KEY } from "@/lib/credits";
import { reelQueue, enqueueReel } from "@/lib/queue";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k).replace(/\./g, "").replace(",", "."));

/** Elle kredi ekleme/çıkarma (eksi değer düşer). */
export async function grantCredits(f: FormData) {
  const admin = await requireAdmin();
  const userId = str(f, "userId");
  const delta = Math.trunc(num(f, "delta"));
  if (!userId || !Number.isFinite(delta) || !delta || Math.abs(delta) > 100_000) throw new Error("Geçersiz kredi miktarı");
  await addCredits({ userId, delta, reason: "admin", note: str(f, "note") || undefined, createdBy: admin.id });
  revalidatePath(`/admin/kullanicilar/${userId}`);
}

/** Ödeme kaydı (havale/EFT…); kredi verildiyse bakiyeye de eklenir. */
export async function recordPayment(f: FormData) {
  const admin = await requireAdmin();
  const userId = str(f, "userId");
  const amountTry = num(f, "amountTry");
  const credits = Math.trunc(num(f, "credits") || 0);
  const method = (str(f, "method") || "havale") as PaymentMethod;
  if (!userId || !Number.isFinite(amountTry) || amountTry <= 0) throw new Error("Geçersiz tutar");
  if (!["havale", "kart", "nakit", "diger"].includes(method)) throw new Error("Geçersiz ödeme yöntemi");
  const id = randomUUID();
  await getDb()
    .insert(payments)
    .values({ id, userId, amountTry, credits, method, status: "paid", reference: str(f, "reference") || null, note: str(f, "note") || null, createdBy: admin.id });
  await addCredits({ userId, delta: credits, reason: "purchase", paymentId: id, createdBy: admin.id });
  revalidatePath(`/admin/kullanicilar/${userId}`);
  revalidatePath("/admin/odemeler");
}

/** Ödeme durumunu değiştirir; iade edilen ödemenin kredisi geri alınır (bekleyen → ödendi'de verilir). */
export async function setPaymentStatus(f: FormData) {
  const admin = await requireAdmin();
  const id = str(f, "id");
  const status = str(f, "status") as PaymentStatus;
  if (!["paid", "pending", "refunded", "failed"].includes(status)) throw new Error("Geçersiz durum");
  const db = getDb();
  const [p] = await db.select().from(payments).where(eq(payments.id, id));
  if (!p || p.status === status) return;
  await db.update(payments).set({ status }).where(eq(payments.id, id));
  const had = p.status === "paid";
  const has = status === "paid";
  if (had !== has)
    await addCredits({ userId: p.userId, delta: has ? p.credits : -p.credits, reason: "purchase", paymentId: id, note: `Ödeme durumu: ${status}`, createdBy: admin.id });
  revalidatePath("/admin/odemeler");
  revalidatePath(`/admin/kullanicilar/${p.userId}`);
}

export async function setUserFlags(f: FormData) {
  const admin = await requireAdmin();
  const userId = str(f, "userId");
  const field = str(f, "field");
  const value = str(f, "value");
  if (userId === admin.id) throw new Error("Kendi hesabınızı değiştiremezsiniz");
  const db = getDb();
  if (field === "role" && (value === "admin" || value === "user")) await db.update(user).set({ role: value }).where(eq(user.id, userId));
  else if (field === "banned") {
    const banned = value === "1";
    await db.update(user).set({ banned }).where(eq(user.id, userId));
    // Engellenen kullanıcının açık oturumları kapanır.
    if (banned) await db.delete(session).where(eq(session.userId, userId));
  } else throw new Error("Geçersiz alan");
  revalidatePath(`/admin/kullanicilar/${userId}`);
  revalidatePath("/admin/kullanicilar");
}

/** Sıradaki ya da süren videoyu durdurur (kuyruktaki iş silinir; süren iş biter ama sonuç yazılmaz). Kredi iade edilir. */
export async function cancelVideo(f: FormData) {
  const admin = await requireAdmin();
  const id = str(f, "id");
  const db = getDb();
  const cancelled = await db
    .update(videos)
    .set({ status: "failed", error: "Yönetici tarafından iptal edildi", finishedAt: new Date() })
    .where(and(eq(videos.id, id), inArray(videos.status, ["queued", "running"])))
    .returning({ id: videos.id });
  if (cancelled.length) await refundVideoCredits(db, id, { note: "İptal", createdBy: admin.id });
  const q = reelQueue();
  for (const job of await q.getJobs(["waiting", "delayed", "prioritized"]))
    if (job.data?.videoId === id) await job.remove().catch(() => {});
  revalidatePath(`/admin/uretimler/${id}`);
  revalidatePath("/admin/uretimler");
}

/** Yeniden üretim: hata/iptalde iade edilen kredi yeniden düşülür. */
export async function retryVideo(f: FormData) {
  const admin = await requireAdmin();
  const id = str(f, "id");
  await rechargeVideoCredits(getDb(), id, admin.id);
  await getDb().update(videos).set({ status: "queued", stage: null, progress: 0, error: null }).where(eq(videos.id, id));
  await enqueueReel(id);
  revalidatePath(`/admin/uretimler/${id}`);
  revalidatePath("/admin/uretimler");
}

/** Videoda düşülen krediyi iade eder (zaten iade edildiyse bir şey yapmaz). */
export async function refundVideo(f: FormData) {
  const admin = await requireAdmin();
  const id = str(f, "id");
  await refundVideoCredits(getDb(), id, { note: str(f, "note") || undefined, createdBy: admin.id });
  revalidatePath(`/admin/uretimler/${id}`);
}

export async function setVideoCost(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const raw = str(f, "costTry");
  const costTry = raw ? num(f, "costTry") : null;
  if (costTry != null && (!Number.isFinite(costTry) || costTry < 0)) throw new Error("Geçersiz maliyet");
  await getDb().update(videos).set({ costTry }).where(eq(videos.id, id));
  revalidatePath(`/admin/uretimler/${id}`);
}

/** Paket satırları "packages.0.name" …; kredisi ya da fiyatı boş satır silinmiş sayılır. */
function readPackages(f: FormData): CreditPackage[] {
  const out: CreditPackage[] = [];
  for (let i = 0; f.has(`packages.${i}.name`); i++) {
    const name = str(f, `packages.${i}.name`);
    const credits = Math.trunc(num(f, `packages.${i}.credits`));
    const priceTry = num(f, `packages.${i}.priceTry`);
    if (!name && !credits && !priceTry) continue;
    if (!name || !(credits > 0) || !(priceTry > 0)) throw new Error(`Paket ${i + 1}: ad, kredi ve fiyat gerekli`);
    const slug = name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    out.push({ id: str(f, `packages.${i}.id`) || slug || `paket-${i + 1}`, name, credits, priceTry });
  }
  if (new Set(out.map((p) => p.id)).size !== out.length) throw new Error("Paket adları farklı olmalı");
  return out.sort((a, b) => a.credits - b.credits);
}

/** Fiyatlandırma ayarları: formdaki alan adları ayar yoluyla aynı ("costUsd.ilan-videosu.perPhoto"). */
export async function savePricing(f: FormData) {
  await requireAdmin();
  const out: Record<string, unknown> = { packages: readPackages(f) };
  for (const [k, v] of f.entries()) {
    if (k.startsWith("$") || k.startsWith("packages.")) continue; // Next.js'in eylem alanları; paketler ayrı okunur
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error(`Geçersiz değer: ${k}`);
    const path = k.split(".");
    let o = out;
    for (const part of path.slice(0, -1)) o = (o[part] ??= {}) as Record<string, unknown>;
    o[path.at(-1)!] = n;
  }
  const value = mergePricing(out);
  await getDb()
    .insert(appSettings)
    .values({ key: PRICING_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  revalidatePath("/admin", "layout");
}
