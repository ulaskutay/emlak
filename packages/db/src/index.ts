import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };
export { and, count, desc, eq, gte, ilike, inArray, ne, or, sql, sum } from "drizzle-orm";

/** Tek bağlantı havuzu (Next.js geliştirme modunda sıcak yeniden yüklemede çoğalmasın). */
const g = globalThis as unknown as { __arsaSql?: ReturnType<typeof postgres> };

export function getDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL ortam değişkeni eksik");
  g.__arsaSql ??= postgres(url, { max: 10 });
  return drizzle(g.__arsaSql, { schema });
}
export type Db = ReturnType<typeof getDb>;

/** Çevre bilgisi önbellek anahtarı: parsel merkezi ~10 m hassasiyetle. */
export const contextKey = (c: { lat: number; lng: number }) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
