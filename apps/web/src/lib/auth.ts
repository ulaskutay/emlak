import "server-only";
import { account, getDb, session, user, verification } from "@arsa/db";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { addCredits, getPricing } from "./credits";
import { sendResetMail, sendVerifyMail } from "./mail";

/** Google ile giriş yalnız istemci bilgileri tanımlıysa açılır. */
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    // Gönderim beklenmez: yanıt süresi e-postanın kayıtlı olup olmadığını ele vermesin.
    sendResetPassword: async ({ user: u, url }) => {
      void sendResetMail(u.email, url).catch((e) => console.error(`Şifre yenileme e-postası gönderilemedi (${u.id}): ${e}`));
    },
  },
  // Giriş serbest; sipariş için e-posta doğrulaması gerekir (api/videos).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: u, url }) => {
      void sendVerifyMail(u.email, url).catch((e) => console.error(`Doğrulama e-postası gönderilemedi (${u.id}): ${e}`));
    },
  },
  socialProviders: googleEnabled
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" } }
    : undefined,
  // Aynı e-postayla önce şifreyle kayıt olan, sonra Google'la gelen kişi aynı hesaba girer.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 600, max: 5 },
      "/request-password-reset": { window: 600, max: 3 },
      "/send-verification-email": { window: 600, max: 3 },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      banned: { type: "boolean", required: false, defaultValue: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // E-postayla kayıtta koşul onayı zorunlu; zaman istemciden değil sunucudan. Google kaydında onay karşılamada alınır.
        before: async (u, ctx) => {
          const accepted = (u as { termsAcceptedAt?: unknown }).termsAcceptedAt;
          if (ctx?.path === "/sign-up/email" && !accepted)
            throw new APIError("BAD_REQUEST", { message: "Kullanım koşullarını ve KVKK metnini onaylayın" });
          return { data: { ...u, termsAcceptedAt: accepted ? new Date() : null } };
        },
        // Hoş geldin kredisi: kayıt bu yüzden bozulmasın, hata yalnız loglanır.
        after: async (u) => {
          const { welcomeCredits } = await getPricing();
          await addCredits({ userId: u.id, delta: welcomeCredits, reason: "welcome", note: "Hoş geldin kredisi" }).catch((e) =>
            console.error(`Hoş geldin kredisi verilemedi (${u.id}): ${e}`),
          );
        },
      },
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
