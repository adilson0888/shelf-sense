CREATE TABLE "preferences" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"ai_api_base_url" text,
	"ai_api_key" text,
	"ai_model" text,
	"default_minimal_quantity" integer DEFAULT 3 NOT NULL,
	"default_freshness_threshold_days" integer DEFAULT 7 NOT NULL,
	"default_does_expire" boolean DEFAULT true NOT NULL,
	"language" text DEFAULT 'en-US' NOT NULL
);
