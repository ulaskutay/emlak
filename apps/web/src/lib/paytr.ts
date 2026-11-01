import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PayTR iFrame API: sunucu token alır, kullanıcı ödemeyi PayTR'nin iframe'inde yapar,
 * sonuç bildirim adresine (Bildirim URL, PayTR mağaza panelinden girilir) POST ile gelir.
 * https://dev.paytr.com/iframe-api
 */
function config() {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const key = process.env.PAYTR_MERCHANT_KEY;
  const salt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !key || !salt) return null;
  return { merchantId, key, salt, testMode: process.env.PAYTR_TEST_MODE === "1" ? "1" : "0" };
}

export const paytrEnabled = () => config() !== null;

const hmac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("base64");

export interface PaytrOrder {
  /** Yalnız harf ve rakam (PayTR alt çizgi/tire kabul etmez). */
  merchantOid: string;
  email: string;
  /** TL, kuruşa yuvarlanır. */
  amountTry: number;
  basket: { name: string; priceTry: number; qty: number }[];
  userIp: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  okUrl: string;
  failUrl: string;
}

/** Ödeme token'ı: iframe adresi https://www.paytr.com/odeme/guvenli/{token}. */
export async function paytrToken(o: PaytrOrder): Promise<string> {
  const c = config();
  if (!c) throw new Error("PayTR ayarları eksik");
  const paymentAmount = String(Math.round(o.amountTry * 100));
  const userBasket = Buffer.from(JSON.stringify(o.basket.map((b) => [b.name, b.priceTry.toFixed(2), b.qty]))).toString("base64");
  const noInstallment = "0";
  const maxInstallment = "0";
  const currency = "TL";
  const hashStr = c.merchantId + o.userIp + o.merchantOid + o.email + paymentAmount + userBasket + noInstallment + maxInstallment + currency + c.testMode;
  const body = new URLSearchParams({
    merchant_id: c.merchantId,
    user_ip: o.userIp,
    merchant_oid: o.merchantOid,
    email: o.email,
    payment_amount: paymentAmount,
    paytr_token: hmac(c.key, hashStr + c.salt),
    user_basket: userBasket,
    debug_on: c.testMode,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: o.userName,
    user_address: o.userAddress,
    user_phone: o.userPhone,
    merchant_ok_url: o.okUrl,
    merchant_fail_url: o.failUrl,
    timeout_limit: "30",
    currency,
    test_mode: c.testMode,
    lang: "tr",
  });
  const res = await fetch("https://www.paytr.com/odeme/api/get-token", { method: "POST", body, signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => null)) as { status?: string; token?: string; reason?: string } | null;
  if (j?.status !== "success" || !j.token) throw new Error(`PayTR token alınamadı: ${j?.reason ?? res.status}`);
  return j.token;
}

export interface PaytrCallback {
  merchantOid: string;
  status: "success" | "failed";
  /** Kuruş (taksit farkı dahil tahsil edilen). */
  totalAmount: string;
  failedReason?: string;
  testMode: boolean;
}

/** Bildirimi doğrular; imza tutmazsa null (sahte istek). */
export function verifyPaytrCallback(f: FormData): PaytrCallback | null {
  const c = config();
  if (!c) return null;
  const get = (k: string) => String(f.get(k) ?? "");
  const merchantOid = get("merchant_oid");
  const status = get("status");
  const totalAmount = get("total_amount");
  const expected = Buffer.from(hmac(c.key, merchantOid + c.salt + status + totalAmount));
  const given = Buffer.from(get("hash"));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (status !== "success" && status !== "failed") return null;
  return {
    merchantOid,
    status,
    totalAmount,
    failedReason: [get("failed_reason_code"), get("failed_reason_msg")].filter(Boolean).join(" ") || undefined,
    testMode: get("test_mode") === "1",
  };
}
