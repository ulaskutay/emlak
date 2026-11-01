import "server-only";
import { addCredits as add, appSettings, creditBalance as balance, eq, getDb, type CreditEntry } from "@arsa/db";
import { DEFAULT_PRICING, mergePricing, templateList, type PricingSettings } from "@arsa/shared";

export const PRICING_KEY = "pricing";

export async function getPricing(): Promise<PricingSettings> {
  const [row] = await getDb().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRICING_KEY));
  return mergePricing(row?.value);
}

/** Şablon kartlarının altındaki kredi yazısı; sunuculu turda sahne başına. */
export function creditLabels(p: PricingSettings): Record<string, string> {
  return Object.fromEntries(
    templateList.map((t) => [t.id, t.id === "sunucu-ev" ? `Sahne başı ${p.tourCredits.orta}–${p.tourCredits.yuksek} kredi` : `${p.credits[t.id]} kredi`]),
  );
}

/** Herkese açık sayfalar için: veritabanına ulaşılamazsa (derleme anı) varsayılan fiyatlar. */
export const creditLabelsSafe = () => getPricing().then(creditLabels, () => creditLabels(DEFAULT_PRICING));

export const creditBalance = (userId: string) => balance(getDb(), userId);

/** Bakiye kontrolü yalnız CREDITS_ENFORCED=1 iken (açılana kadar sipariş kredisiz de alınır, bakiye eksiye düşer). */
export const creditsEnforced = () => process.env.CREDITS_ENFORCED === "1";

export const addCredits = (e: CreditEntry) => add(getDb(), e);
