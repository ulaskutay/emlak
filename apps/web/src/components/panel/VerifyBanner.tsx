"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** E-postası doğrulanmamış kullanıcıya panelin üstünde: sipariş için doğrulama gerekir, bağlantı yeniden gönderilebilir. */
export function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function resend() {
    setState("busy");
    const res = await authClient.sendVerificationEmail({ email, callbackURL: "/panel" });
    setState(res.error ? "error" : "sent");
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-gunes/60 bg-gunes-acik px-5 py-4" role="status">
      <p className="min-w-0 text-[0.9375rem] leading-snug">
        <span className="font-extrabold">E-postanızı doğrulayın.</span>{" "}
        <span className="text-gri">
          Sipariş verebilmek için <span className="font-semibold text-lacivert">{email}</span> adresine gönderdiğimiz bağlantıya tıklayın.
        </span>
      </p>
      {state === "sent" ? (
        <span className="text-sm font-bold text-cimen-koyu">Yeni bağlantı gönderildi</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "busy"}
          className="pnl-btn-ghost shrink-0 bg-white"
        >
          {state === "busy" ? "Gönderiliyor…" : state === "error" ? "Tekrar deneyin" : "Bağlantıyı yeniden gönder"}
        </button>
      )}
    </div>
  );
}
