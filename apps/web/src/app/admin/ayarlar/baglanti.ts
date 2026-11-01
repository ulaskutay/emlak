"use server";
import { appSettings, getDb } from "@arsa/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { clearIntegrationsCache, INTEGRATIONS_KEY, storedIntegrations } from "@/lib/integrations";
import { sendTestMail } from "@/lib/mail";

export type BaglantiState = { ok?: string; error?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** E-posta sunucusu ve Google girişi. Şifre alanları boş bırakılırsa kayıtlı değer korunur; "sil" işaretliyse temizlenir. */
export async function saveIntegrations(_: BaglantiState, f: FormData): Promise<BaglantiState> {
  await requireAdmin();
  const old = await storedIntegrations();
  const secret = (k: string, prev?: string) => (f.get(`${k}.sil`) ? "" : str(f, k) || prev || "");
  const port = Number(str(f, "smtp.port") || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "Geçersiz port" };
  const value = {
    smtp: {
      host: str(f, "smtp.host"),
      port,
      user: str(f, "smtp.user"),
      pass: secret("smtp.pass", old.smtp?.pass),
      from: str(f, "smtp.from"),
    },
    google: { clientId: str(f, "google.clientId"), clientSecret: secret("google.clientSecret", old.google?.clientSecret) },
  };
  await getDb()
    .insert(appSettings)
    .values({ key: INTEGRATIONS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  clearIntegrationsCache();
  revalidatePath("/admin/ayarlar");
  return { ok: "Bağlantı ayarları kaydedildi" };
}

/** Kayıtlı SMTP ayarıyla yöneticinin kendi adresine deneme e-postası. */
export async function testMail(_: BaglantiState): Promise<BaglantiState> {
  const admin = await requireAdmin();
  try {
    const sent = await sendTestMail(admin.email);
    return sent ? { ok: `Deneme e-postası ${admin.email} adresine gönderildi` } : { error: "Önce e-posta sunucusunu kaydedin" };
  } catch (e) {
    return { error: `Gönderilemedi: ${e instanceof Error ? e.message : String(e)}` };
  }
}
