ALTER TABLE "user" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "segments" text[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Doğrulama zorunluluğundan önce açılmış hesaplar doğrulanmış sayılır.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
