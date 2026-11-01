"use client";
import { useState } from "react";

/** Şifre gücü: uzunluk ve karakter çeşitliliği (0–4). */
function strength(p: string) {
  if (p.length < 8) return 0;
  let s = 1;
  if (p.length >= 12) s++;
  if (/[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p)) s++;
  if (/\d/.test(p) && /[^\w\sçğıöşüÇĞİÖŞÜ]/.test(p)) s++;
  else if (/\d/.test(p) || /[^\w\s]/.test(p)) s += 0.5;
  return Math.min(4, Math.floor(s));
}
const LEVELS = [
  { label: "En az 8 karakter", bar: "bg-ayrac", text: "text-gri" },
  { label: "Zayıf", bar: "bg-mercan", text: "text-mercan-koyu" },
  { label: "Orta", bar: "bg-gunes", text: "text-[#9a6a00]" },
  { label: "İyi", bar: "bg-cimen", text: "text-cimen-koyu" },
  { label: "Güçlü", bar: "bg-cimen", text: "text-cimen-koyu" },
];

/** Göster/gizle düğmeli şifre alanı; yeni şifrede güç göstergesi. */
export function PasswordField({
  id = "password",
  label = "Şifre",
  isNew = false,
  aside,
}: {
  id?: string;
  label?: string;
  isNew?: boolean;
  aside?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const lvl = LEVELS[strength(value)];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="site-label mb-0" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="relative">
        <input
          className="site-input pr-24"
          id={id}
          name={id}
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete={isNew ? "new-password" : "current-password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={isNew ? `${id}-guc` : undefined}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-1.5 h-9 -translate-y-1/2 rounded-lg px-3 text-sm font-bold text-gri hover:bg-gok-acik hover:text-gok"
          aria-pressed={show}
          aria-controls={id}
        >
          {show ? "Gizle" : "Göster"}
        </button>
      </div>
      {isNew && (
        <div id={`${id}-guc`} className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-1.5 rounded-full ${strength(value) >= n ? lvl.bar : "bg-ayrac"}`} />
            ))}
          </div>
          <span className={`w-28 text-right text-[0.8125rem] font-semibold ${lvl.text}`}>{lvl.label}</span>
        </div>
      )}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "ok" | "info"; children: React.ReactNode }) {
  const c =
    tone === "error"
      ? "border-mercan/30 bg-mercan-acik text-mercan-koyu"
      : tone === "ok"
        ? "border-cimen/30 bg-cimen-acik text-cimen-koyu"
        : "border-gok/20 bg-gok-acik text-gok-koyu";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-snug font-semibold ${c}`}>{children}</p>;
}

export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button className="site-btn-primary w-full" disabled={busy} aria-busy={busy}>
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      {busy ? "Bekleyin…" : children}
    </button>
  );
}

export function GoogleButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="site-btn-secondary w-full">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      Google ile devam edin
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[0.8125rem] font-semibold text-gri" aria-hidden>
      <span className="h-px flex-1 bg-ayrac" />
      ya da e-posta ile
      <span className="h-px flex-1 bg-ayrac" />
    </div>
  );
}

/** Better Auth hata kodları → Türkçe mesaj. */
export function authError(e: { code?: string; message?: string; status?: number }) {
  if (e.status === 429) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.";
  switch (e.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-posta ya da şifre hatalı";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Bu e-posta ile kayıtlı bir hesap var";
    case "PASSWORD_TOO_SHORT":
      return "Şifre en az 8 karakter olmalı";
    case "INVALID_TOKEN":
      return "Bağlantının süresi dolmuş ya da geçersiz. Yeni bir bağlantı isteyin.";
    case "INVALID_EMAIL":
      return "Geçerli bir e-posta adresi girin";
    default:
      return e.message ?? "Bir hata oluştu";
  }
}
