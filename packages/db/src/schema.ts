import type { ReelListing, ReelStatus, TemplateId, TemplateInput } from "@arsa/shared";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

// ---- Better Auth (e-posta + şifre) — alan adları Better Auth'un beklediğiyle aynı ----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "admin": süper yönetici paneli (/admin). ADMIN_EMAILS ortam değişkenindeki adresler de yöneticidir. */
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  /** Engelli kullanıcı oturum açsa da panele ve API'ye giremez. */
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Videolar ----
/** Parsel özeti: listede ve detayda gösterilir (dosyayı her seferinde ayrıştırmamak için). */
export interface ParcelSummary {
  areaM2: number;
  ada?: string;
  parsel?: string;
  nitelik?: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  centroid: { lat: number; lng: number };
}

export const videos = pgTable(
  "videos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Şablon (packages/shared/src/templates.ts). */
    template: text("template").$type<TemplateId>().notNull().default("arsa-drone"),
    /** Şablona özgü girdi (ilan fotoğrafları, yapı tipi…). */
    input: jsonb("input").$type<TemplateInput>().notNull().default({}),
    status: text("status").$type<ReelStatus>().notNull().default("queued"),
    /** Şablonun aşama kimliği (TEMPLATES[template].stages). */
    stage: text("stage"),
    /** Aşama içi ilerleme 0..1 (render'da kare oranı). */
    progress: real("progress").notNull().default(0),
    /** Parsel kullanan şablonlarda dolu (ilan videosunda boş). */
    parcelFileName: text("parcel_file_name"),
    parcelText: text("parcel_text"),
    parcelSummary: jsonb("parcel_summary").$type<ParcelSummary>(),
    listing: jsonb("listing").$type<ReelListing>().notNull().default({}),
    voiceId: text("voice_id"),
    music: boolean("music").notNull().default(true),
    /** R2 anahtarları (link her istekte imzalanır). */
    reelKey: text("reel_key"),
    keyframeKey: text("keyframe_key"),
    durationSec: real("duration_sec"),
    error: text("error"),
    /** Aşama süreleri, render ayrıntısı. */
    stats: jsonb("stats").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    /** Siparişte düşülen kullanıcı kredisi. */
    credits: integer("credits").notNull().default(0),
    /** Gerçek maliyet (TL, yönetici girer); boşsa ayarlardaki tahmin kullanılır. */
    costTry: real("cost_try"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("videos_user_created_idx").on(t.userId, t.createdAt)],
);

/** Çevre bilgisi önbelleği (Google Places + yükseklik verisi): parsel merkezine göre. */
export const parcelContexts = pgTable("parcel_contexts", {
  key: text("key").primaryKey(),
  context: jsonb("context").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Video = typeof videos.$inferSelect;

// ---- Kredi ve ödeme ----
export type CreditReason = "admin" | "purchase" | "video" | "refund";

/** Kredi hareketleri: bakiye = delta toplamı (eksiye düşebilir, CREDITS_ENFORCED açık değilse). */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").$type<CreditReason>().notNull(),
    videoId: text("video_id"),
    paymentId: text("payment_id"),
    note: text("note"),
    /** Elle yapılan hareketlerde yöneticinin kimliği. */
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_ledger_user_idx").on(t.userId, t.createdAt)],
);

export type PaymentStatus = "paid" | "pending" | "refunded";
export type PaymentMethod = "havale" | "kart" | "nakit" | "diger";

/** Ödemeler: ödeme altyapısı gelene kadar yönetici elle girer (havale/EFT). */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountTry: real("amount_try").notNull(),
    credits: integer("credits").notNull().default(0),
    method: text("method").$type<PaymentMethod>().notNull().default("havale"),
    status: text("status").$type<PaymentStatus>().notNull().default("paid"),
    /** Ödeme sağlayıcısındaki işlem numarası ya da dekont no. */
    reference: text("reference"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_created_idx").on(t.createdAt)],
);

/** Uygulama ayarları (anahtar → JSON): fiyatlandırma ve maliyet tahmini. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
