"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { FormMessage, GoogleButton, OrDivider, PasswordField, SubmitButton, authError } from "./auth/fields";

const NOTICES = {
  engelli: { tone: "error", text: "Hesabınız askıya alındı. Bilgi için bizimle iletişime geçin." },
  sifre: { tone: "ok", text: "Şifreniz yenilendi. Yeni şifrenizle giriş yapın." },
} as const;
export type AuthNotice = keyof typeof NOTICES;

export function AuthForm({
  mode,
  next,
  google = false,
  notice,
}: {
  mode: "login" | "signup";
  next?: string;
  google?: boolean;
  notice?: AuthNotice;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const q = next ? `?sonra=${encodeURIComponent(next)}` : "";
  // Yeni hesap önce karşılamaya uğrar (şablon önerisi, Google'la gelende KVKK onayı); seçilmiş şablon varsa oraya devam eder.
  const welcome = `/panel/hosgeldin${q}`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    setBusy(true);
    setError(null);
    const res = signup
      ? await authClient.signUp.email({
          email,
          password,
          name: String(f.get("name") || "").trim() || email.split("@")[0],
          termsAcceptedAt: new Date(),
          callbackURL: next ?? "/panel",
        })
      : await authClient.signIn.email({ email, password });
    if (res.error) {
      setBusy(false);
      setError(authError(res.error));
      return;
    }
    router.replace(signup ? (next ?? welcome) : (next ?? "/panel"));
    router.refresh();
  }

  async function withGoogle() {
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: next ?? "/panel", newUserCallbackURL: welcome });
    if (res.error) {
      setBusy(false);
      setError(authError(res.error));
    }
  }

  return (
    <div>
      <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.03em]">
        {signup ? "Hesabınızı oluşturun" : "Tekrar hoş geldiniz"}
      </h1>
      <p className="mt-2.5 text-[1.0625rem] leading-snug text-gri">
        {signup
          ? "Şablonu seçin, bilgileri girin; videonuz birkaç dakikada hazır."
          : "Videolarınıza ve şablonlarınıza devam etmek için giriş yapın."}
      </p>

      <div className="mt-8 space-y-5">
        {notice && <FormMessage tone={NOTICES[notice].tone}>{NOTICES[notice].text}</FormMessage>}

        {google && (
          <>
            <GoogleButton onClick={withGoogle} busy={busy} />
            <OrDivider />
          </>
        )}

        <form onSubmit={submit} className="space-y-4">
          {signup && (
            <div>
              <label className="site-label" htmlFor="name">Ofis ya da ad soyad</label>
              <input className="site-input" id="name" name="name" placeholder="Örn. Etic Emlak" autoComplete="organization" />
            </div>
          )}
          <div>
            <label className="site-label" htmlFor="email">E-posta</label>
            <input className="site-input" id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="ornek@ofisiniz.com" />
          </div>
          <PasswordField
            isNew={signup}
            aside={
              !signup && (
                <Link href="/sifremi-unuttum" className="text-sm font-bold text-gok hover:underline">
                  Şifremi unuttum
                </Link>
              )
            }
          />
          {signup && (
            <label className="flex items-start gap-3 rounded-xl text-sm leading-relaxed text-gri">
              <input type="checkbox" name="terms" required className="mt-0.5 size-5 shrink-0 accent-gok" />
              <span>
                <Link href="/kullanim-kosullari" target="_blank" className="font-bold text-lacivert underline decoration-ayrac underline-offset-2 hover:text-gok">
                  Kullanım koşullarını
                </Link>{" "}
                okudum, kabul ediyorum. Kişisel verilerim{" "}
                <Link href="/kvkk" target="_blank" className="font-bold text-lacivert underline decoration-ayrac underline-offset-2 hover:text-gok">
                  KVKK aydınlatma metni
                </Link>{" "}
                kapsamında işlenir.
              </span>
            </label>
          )}
          <div aria-live="assertive">{error && <FormMessage tone="error">{error}</FormMessage>}</div>
          <SubmitButton busy={busy}>{signup ? "Hesap oluşturun" : "Giriş yapın"}</SubmitButton>
        </form>

        <p className="text-center text-[0.9375rem] text-gri">
          {signup ? "Hesabınız var mı? " : "Hesabınız yok mu? "}
          <Link className="font-bold text-gok hover:underline" href={`${signup ? "/giris" : "/kayit"}${q}`}>
            {signup ? "Giriş yapın" : "Kayıt olun"}
          </Link>
        </p>
      </div>
    </div>
  );
}
