"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { SiteLogo } from "./site/SiteLogo";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    setError(null);
    const res = signup
      ? await authClient.signUp.email({ email, password, name: String(f.get("name") || email.split("@")[0]) })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-posta ya da şifre hatalı"
          : res.error.code === "USER_ALREADY_EXISTS" || res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Bu e-posta ile kayıtlı bir hesap var"
            : res.error.code === "PASSWORD_TOO_SHORT"
              ? "Şifre en az 8 karakter olmalı"
              : (res.error.message ?? "Bir hata oluştu"),
      );
      return;
    }
    router.replace(next ?? "/panel");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="Ana sayfa"><SiteLogo tone="dark" /></Link>
          <p className="mt-3 text-sm text-mute">Şablonu seçin, bilgileri girin, video birkaç dakikada hazır</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="text-lg font-bold">{signup ? "Hesap oluştur" : "Giriş yap"}</h1>
          {signup && (
            <div>
              <label className="label" htmlFor="name">Ofis / ad soyad</label>
              <input className="input" id="name" name="name" placeholder="Örn. Etic Emlak" autoComplete="organization" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">E-posta</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Şifre</label>
            <input className="input" id="password" name="password" type="password" required minLength={8}
              autoComplete={signup ? "new-password" : "current-password"} />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Bekleyin…" : signup ? "Kayıt ol" : "Giriş yap"}</button>
          <p className="text-center text-sm text-mute">
            {signup ? "Hesabınız var mı? " : "Hesabınız yok mu? "}
            <Link className="font-semibold text-neon hover:underline" href={`${signup ? "/giris" : "/kayit"}${next ? `?sonra=${encodeURIComponent(next)}` : ""}`}>
              {signup ? "Giriş yapın" : "Kayıt olun"}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
