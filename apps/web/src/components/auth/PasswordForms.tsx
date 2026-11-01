"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { FormMessage, PasswordField, SubmitButton, authError } from "./fields";

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2.5 text-[1.0625rem] leading-snug text-gri">{sub}</p>
    </>
  );
}

const back = (
  <p className="text-center text-[0.9375rem] text-gri">
    <Link className="font-bold text-gok hover:underline" href="/giris">
      Girişe dönün
    </Link>
  </p>
);

/** E-posta ister, yenileme bağlantısı gönderir. Hesap olsun olmasın aynı yanıt: kayıtlı adresler ele verilmez. */
export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setError(null);
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/sifre-sifirla" });
    setBusy(false);
    if (res.error) return setError(authError(res.error));
    setSent(email);
  }

  return (
    <div>
      <Heading title="Şifrenizi mi unuttunuz?" sub="Hesabınızın e-posta adresini yazın; yeni şifre belirlemeniz için bir bağlantı gönderelim." />
      <div className="mt-8 space-y-5">
        {sent ? (
          <FormMessage tone="ok">
            {sent} adresi kayıtlıysa yenileme bağlantısı birkaç dakika içinde gelir. Gelen kutunuzu ve istenmeyen klasörünü kontrol edin.
          </FormMessage>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="site-label" htmlFor="email">E-posta</label>
              <input className="site-input" id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
            </div>
            <div aria-live="assertive">{error && <FormMessage tone="error">{error}</FormMessage>}</div>
            <SubmitButton busy={busy}>Bağlantı gönderin</SubmitButton>
          </form>
        )}
        {back}
      </div>
    </div>
  );
}

/** E-postadaki bağlantıdan gelinir (?token=); geçersiz ya da süresi dolmuşsa yeni bağlantı istenir. */
export function ResetForm({ token }: { token?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("password2"))) return setError("Şifreler aynı değil");
    setBusy(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token: token! });
    if (res.error) {
      setBusy(false);
      return setError(authError(res.error));
    }
    router.replace("/giris?sifre=yenilendi");
  }

  if (!token)
    return (
      <div>
        <Heading title="Bağlantı geçersiz" sub="Şifre yenileme bağlantısının süresi dolmuş ya da daha önce kullanılmış." />
        <div className="mt-8 space-y-5">
          <Link href="/sifremi-unuttum" className="site-btn-primary w-full">
            Yeni bağlantı isteyin
          </Link>
          {back}
        </div>
      </div>
    );

  return (
    <div>
      <Heading title="Yeni şifrenizi belirleyin" sub="En az 8 karakter. Kaydettiğinizde diğer cihazlardaki oturumlar kapanır." />
      <form onSubmit={submit} className="mt-8 space-y-4">
        <PasswordField label="Yeni şifre" isNew />
        <div>
          <label className="site-label" htmlFor="password2">Yeni şifre (tekrar)</label>
          <input className="site-input" id="password2" name="password2" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div aria-live="assertive">{error && <FormMessage tone="error">{error}</FormMessage>}</div>
        <SubmitButton busy={busy}>Şifreyi kaydedin</SubmitButton>
      </form>
    </div>
  );
}
