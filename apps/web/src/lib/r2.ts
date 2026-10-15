import "server-only";
import { r2FromEnv, type R2 } from "@arsa/providers";

const g = globalThis as unknown as { __r2?: R2 | null };

export function r2(): R2 {
  if (g.__r2 === undefined) g.__r2 = r2FromEnv();
  if (!g.__r2) throw new Error("R2 ayarları eksik (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
  return g.__r2;
}
