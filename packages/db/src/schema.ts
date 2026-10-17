import type { ReelListing, ReelStage, ReelStatus } from "@arsa/shared";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

// ---- Better Auth (e-posta + şifre) — alan adları Better Auth'un beklediğiyle aynı ----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    status: text("status").$type<ReelStatus>().notNull().default("queued"),
    stage: text("stage").$type<ReelStage>(),
    /** Aşama içi ilerleme 0..1 (render'da kare oranı). */
    progress: real("progress").notNull().default(0),
    parcelFileName: text("parcel_file_name").notNull(),
    parcelText: text("parcel_text").notNull(),
    parcelSummary: jsonb("parcel_summary").$type<ParcelSummary>().notNull(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("videos_user_created_idx").on(t.userId, t.createdAt)],
);

/** Çevre bilgisi önbelleği (Google Places + yükseklik verisi): parsel merkezine göre. */
export const parcelContexts = pgTable("parcel_contexts", {
  key: text("key").primaryKey(),
  context: jsonb("context").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Video = typeof videos.$inferSelect;
