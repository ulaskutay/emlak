ALTER TABLE "payments" ADD COLUMN "merchant_oid" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "package_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_oid_unique" UNIQUE("merchant_oid");