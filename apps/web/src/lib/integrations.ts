import "server-only";
import { appSettings, eq, getDb } from "@arsa/db";

export const INTEGRATIONS_KEY = "integrations";

/** Yönetim > Ayarlar'dan girilen bağlantı bilgileri (e-posta sunucusu, Google girişi). Boş alan ortam değişkenine düşer. */
export interface Integrations {
  smtp: { host: string; port: number; user: string; pass: string; from: string };
  google: { clientId: string; clientSecret: string };
}

type Stored = { smtp?: Partial<Integrations["smtp"]>; google?: Partial<Integrations["google"]> };

const pick = (v: unknown, env?: string) => (typeof v === "string" && v.trim() ? v.trim() : (env ?? "").trim());

export function mergeIntegrations(s: Stored | null | undefined): Integrations {
  const e = process.env;
  return {
    smtp: {
      host: pick(s?.smtp?.host, e.SMTP_HOST),
      port: Number(s?.smtp?.port) || Number(e.SMTP_PORT) || 587,
      user: pick(s?.smtp?.user, e.SMTP_USER),
      pass: pick(s?.smtp?.pass, e.SMTP_PASS),
      from: pick(s?.smtp?.from, e.SMTP_FROM),
    },
    google: { clientId: pick(s?.google?.clientId, e.GOOGLE_CLIENT_ID), clientSecret: pick(s?.google?.clientSecret, e.GOOGLE_CLIENT_SECRET) },
  };
}

/** Kayıtlı ham değer (yönetim formu: şifreler geri gösterilmez, boş bırakılınca korunur). */
export async function storedIntegrations(): Promise<Stored> {
  const [row] = await getDb().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, INTEGRATIONS_KEY));
  return (row?.value as Stored | undefined) ?? {};
}

// Her istekte veritabanına gitmesin: kısa süreli önbellek; kaydedince hemen boşaltılır.
// globalThis'te: sunucu eylemleri ile sayfalar ayrı modül kopyası yükleyebiliyor, temizleme hepsine ulaşmalı.
const g = globalThis as unknown as { __arsaIntegrations?: { at: number; value: Integrations } | null };
const TTL = 30_000;

export async function getIntegrations(): Promise<Integrations> {
  const c = g.__arsaIntegrations;
  if (c && Date.now() - c.at < TTL) return c.value;
  const value = mergeIntegrations(await storedIntegrations().catch(() => ({})));
  g.__arsaIntegrations = { at: Date.now(), value };
  return value;
}

export function clearIntegrationsCache() {
  g.__arsaIntegrations = null;
}

export const isMailReady = (i: Integrations) => Boolean(i.smtp.host);
export const isGoogleReady = (i: Integrations) => Boolean(i.google.clientId && i.google.clientSecret);
