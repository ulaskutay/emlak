import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "./index.js";
import { creditLedger, videos, type CreditReason } from "./schema.js";

/** Tek işlem içinde (db ya da tx) çalışan yardımcılar ikisini de kabul eder. */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

export interface CreditEntry {
  userId: string;
  delta: number;
  reason: CreditReason;
  videoId?: string;
  paymentId?: string;
  note?: string;
  createdBy?: string;
}

export async function creditBalance(db: Conn, userId: string) {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return r?.total ?? 0;
}

export async function addCredits(db: Conn, e: CreditEntry) {
  if (!e.delta) return;
  await db.insert(creditLedger).values({ id: randomUUID(), ...e });
}

/**
 * Kullanıcının kredi hareketlerini işlem sonuna kadar sıraya sokar: aynı anda gelen iki sipariş
 * aynı bakiyeyi görüp ikisi de geçemez.
 */
export const lockUserCredits = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"credits:" + userId}))`);

/** Videonun kullanıcıdan net düşülen kredisi (düşüm eksi iadeler). */
export async function videoNetCharge(db: Conn, videoId: string) {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.videoId, videoId));
  return -(r?.total ?? 0);
}

/**
 * Videonun düşülen kredisini geri verir. Net düşüm sıfırsa bir şey yapmaz: worker hatası,
 * yönetici iptali ve elle iade aynı videoda üst üste gelse de kredi bir kez döner.
 */
export async function refundVideoCredits(db: Db, videoId: string, opts: { note?: string; createdBy?: string } = {}) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select({ userId: videos.userId }).from(videos).where(eq(videos.id, videoId));
    if (!v) return 0;
    await lockUserCredits(tx, v.userId);
    const net = await videoNetCharge(tx, videoId);
    if (net <= 0) return 0;
    await addCredits(tx, { userId: v.userId, delta: net, reason: "refund", videoId, ...opts });
    return net;
  });
}

/**
 * Yeniden denenen video iade edildiyse kredisini tekrar düşer (bakiye bakılmaz: yönetici başlatır).
 * Hiç iade edilmediyse bir şey yapmaz.
 */
export async function rechargeVideoCredits(db: Db, videoId: string, createdBy?: string) {
  await db.transaction(async (tx) => {
    const [v] = await tx.select({ userId: videos.userId, credits: videos.credits }).from(videos).where(eq(videos.id, videoId));
    if (!v?.credits) return;
    await lockUserCredits(tx, v.userId);
    const net = await videoNetCharge(tx, videoId);
    if (net >= v.credits) return;
    await addCredits(tx, { userId: v.userId, delta: -(v.credits - net), reason: "video", videoId, note: "Yeniden deneme", createdBy });
  });
}
