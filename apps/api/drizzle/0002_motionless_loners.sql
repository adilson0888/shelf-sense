ALTER TABLE "preferences" ADD COLUMN "default_minimal_percentage" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tracking_mode" text DEFAULT 'units' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock_percent" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "minimal_percentage" integer;