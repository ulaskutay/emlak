import "server-only";
import { randomUUID } from "node:crypto";
import { appSettings, creditLedger, eq, getDb, sql, type CreditReason } from "@arsa/db";
import { mergePricing, type PricingSettings } from "@arsa/shared";

export const PRICING_KEY = "pricing";

export async function getPricing(): Promise<PricingSettings> {
  const [row] = await getDb().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRICING_KEY));
  return mergePricing(row?.value);
}

export async function creditBalance(userId: string) {
  const [r] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return r?.total ?? 0;
}

/** Bakiye kontrolü yalnız CREDITS_ENFORCED=1 iken (açılana kadar sipariş kredisiz de alınır, bakiye eksiye düşer). */
export const creditsEnforced = () => process.env.CREDITS_ENFORCED === "1";

export async function addCredits(e: {
  userId: string;
  delta: number;
  reason: CreditReason;
  videoId?: string;
  paymentId?: string;
  note?: string;
  createdBy?: string;
}) {
  if (!e.delta) return;
  await getDb().insert(creditLedger).values({ id: randomUUID(), ...e });
}
