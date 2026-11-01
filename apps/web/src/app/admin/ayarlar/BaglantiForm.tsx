"use client";
import { useActionState } from "react";
import { saveIntegrations, testMail, type BaglantiState } from "./baglanti";

type Props = {
  smtp: { host: string; port: number; user: string; from: string; hasPass: boolean };
  google: { clientId: string; hasSecret: boolean };
  mailReady: boolean;
  googleReady: boolean;
  callbackUrl: string;
};

function Durum({ on }: { on: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${on ? "bg-cimen-acik text-cimen-koyu" : "bg-zemin text-gri"}`}>
      {on ? "Açık" : "Kapalı"}
    </span>
  );
}

function Input({ name, label, value, type = "text", placeholder, hint }: { name: string; label: string; value?: string | number; type?: string; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="adm-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} placeholder={placeholder} autoComplete="off" className="adm-input" />
      {hint ? <p className="mt-1 text-xs text-gri">{hint}</p> : null}
    </div>
  );
}

function Secret({ name, label, saved }: { name: string; label: string; saved: boolean }) {
  return (
    <div>
      <label className="adm-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="password" placeholder={saved ? "Kayıtlı · değiştirmek için yazın" : ""} autoComplete="new-password" className="adm-input" />
      {saved ? (
        <label className="mt-1.5 flex items-center gap-2 text-xs text-gri">
          <input type="checkbox" name={`${name}.sil`} className="accent-mercan" /> Kayıtlı değeri sil
        </label>
      ) : null}
    </div>
  );
}

function Mesaj({ s }: { s: BaglantiState }) {
  if (!s) return null;
  return (
    <p role={s.error ? "alert" : "status"} className={`text-sm font-semibold ${s.error ? "text-mercan-koyu" : "text-cimen-koyu"}`}>
      {s.error ?? s.ok}
    </p>
  );
}

/** Yönetim > Ayarlar: hesap e-postaları (SMTP) ve Google ile giriş. Boş alanlar sunucu ortam değişkenine düşer. */
export function BaglantiForm({ smtp, google, mailReady, googleReady, callbackUrl }: Props) {
  const [saved, save, saving] = useActionState(saveIntegrations, null);
  const [tested, test, testing] = useActionState(testMail, null);

  return (
    <form action={save} className="mt-3 max-w-4xl space-y-3">
      <section className="adm-kart p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-extrabold">Hesap e-postaları (SMTP)</h2>
          <Durum on={mailReady} />
        </div>
        <p className="mt-1 text-sm text-gri">
          Doğrulama ve şifre yenileme e-postaları bu sunucudan gider. Kapalıyken e-posta gönderilmez ve sipariş için e-posta doğrulaması istenmez.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input name="smtp.host" label="Sunucu" value={smtp.host} placeholder="mail.eticajans.com" />
          </div>
          <Input name="smtp.port" label="Port" value={smtp.port} hint="587 (STARTTLS) ya da 465 (SSL)" />
          <Input name="smtp.user" label="Kullanıcı adı" value={smtp.user} placeholder="info@eticajans.com" />
          <Secret name="smtp.pass" label="Şifre" saved={smtp.hasPass} />
          <Input name="smtp.from" label="Gönderen" value={smtp.from} placeholder="Arsa Video <info@eticajans.com>" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" formAction={test} disabled={testing || !mailReady} className="adm-btn-ghost">
            {testing ? "Gönderiliyor…" : "Deneme e-postası gönder"}
          </button>
          <Mesaj s={tested} />
        </div>
      </section>

      <section className="adm-kart p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-extrabold">Google ile giriş</h2>
          <Durum on={googleReady} />
        </div>
        <p className="mt-1 text-sm text-gri">
          Google Cloud Console &gt; API&apos;ler ve Hizmetler &gt; Kimlik bilgileri &gt; OAuth istemci kimliği (Web uygulaması). Yetkili yönlendirme URI&apos;si:
        </p>
        <code className="mt-2 block rounded-lg bg-zemin px-3 py-2 text-sm break-all select-all">{callbackUrl}</code>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input name="google.clientId" label="İstemci kimliği (Client ID)" value={google.clientId} placeholder="…apps.googleusercontent.com" />
          <Secret name="google.clientSecret" label="İstemci sırrı (Client secret)" saved={google.hasSecret} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 pt-3">
        <button className="adm-btn-primary px-6" disabled={saving}>
          {saving ? "Kaydediliyor…" : "Bağlantıları kaydet"}
        </button>
        <Mesaj s={saved} />
      </div>
    </form>
  );
}
