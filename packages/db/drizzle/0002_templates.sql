ALTER TABLE "videos" ALTER COLUMN "parcel_file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "parcel_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "parcel_summary" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "template" text DEFAULT 'arsa-drone' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "input" jsonb DEFAULT '{}'::jsonb NOT NULL;