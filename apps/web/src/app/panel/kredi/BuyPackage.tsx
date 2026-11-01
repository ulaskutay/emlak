"use client";
import type { CreditPackage } from "@arsa/shared";
import { useEffect, useRef, useState } from "react";

const PHONE_KEY = "arsa:telefon";

/** Paket satın alma: telefon (PayTR zorunlu tutar) → PayTR iframe'i pencerede. */
export function BuyPackage({ pack, enabled, featured }: { pack: CreditPackage; enabled: boolean; featured?: boolean }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      setPhone(localStorage.getItem(PHONE_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(PHONE_KEY, phone);
    } catch {}
    const res = await fetch("/api/odeme/paytr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packageId: pack.id, phone }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { token?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.token) return setError(data?.error ?? "Ödeme başlatılamadı");
    setToken(data.token);
  }

  const close = () => {
    setOpen(false);
    setToken(null);
    setError(null);
  };

  return (
    <>
      <button type="button" disabled={!enabled} onClick={() => setOpen(true)} className={`${featured ? "pnl-btn-primary" : "pnl-btn-ghost"} mt-5 w-full`}>
        {enabled ? "Satın al" : "Kartla ödeme yakında"}
      </button>
      <dialog
        ref={dialog}
        onClose={close}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-ayrac bg-white p-0 text-lacivert shadow-2xl backdrop:bg-lacivert/40"
      >
        <div className="flex items-center justify-between gap-4 border-b border-ayrac px-5 py-4">
          <div>
            <div className="font-extrabold">{pack.name} paketi</div>
            <div className="text-sm text-gri">
              {pack.credits.toLocaleString("tr-TR")} kredi · {pack.priceTry.toLocaleString("tr-TR")} ₺
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Kapat" className="grid h-11 w-11 place-items-center rounded-xl text-gri hover:bg-zemin hover:text-lacivert">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>
        {token ? (
          <iframe src={`https://www.paytr.com/odeme/guvenli/${token}`} title="PayTR güvenli ödeme" className="block h-[min(42rem,75dvh)] w-full border-0" />
        ) : (
          <form onSubmit={start} className="space-y-4 p-5">
            <div>
              <label htmlFor={`tel-${pack.id}`} className="pnl-label">Cep telefonu</label>
              <input
                id={`tel-${pack.id}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="05xx xxx xx xx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pnl-input"
              />
              <p className="mt-1.5 text-xs text-gri">Ödeme kuruluşu fatura ve güvenlik doğrulaması için ister.</p>
            </div>
            {error ? <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p> : null}
            <button disabled={busy} className="pnl-btn-primary w-full">{busy ? "Hazırlanıyor…" : "Ödemeye geç"}</button>
          </form>
        )}
      </dialog>
    </>
  );
}

/** PayTR ödeme sonrası dönüş adresini iframe içinde açar: sayfa iframe'deyse üst pencereye taşınır. */
export function LeaveIframe() {
  useEffect(() => {
    if (window.top && window.top !== window.self) window.top.location.href = window.location.href;
  }, []);
  return null;
}
