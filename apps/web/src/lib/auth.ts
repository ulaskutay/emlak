import "server-only";
import { account, getDb, session, user, verification } from "@arsa/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 30 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      banned: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Süper yönetici: ADMIN_EMAILS (virgülle) listesindeki e-posta. */
export function isSuperAdmin(u: { email: string }) {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(u.email.toLowerCase());
}

/** Yönetici: süper yönetici ya da rolü admin olan. */
export function isAdmin(u: { email: string; role?: string | null }) {
  return u.role === "admin" || isSuperAdmin(u);
}

/** Sayfalar için: oturum yoksa girişe yönlendirir. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/giris");
  if (s.user.banned) redirect("/giris?engelli=1");
  return s.user;
}

/** Yönetici sayfaları: yönetici değilse sayfa yokmuş gibi davranır. */
export async function requireAdmin() {
  const u = await requireUser();
  if (!isAdmin(u)) notFound();
  return u;
}
