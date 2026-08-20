CREATE TABLE "comparison_sites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_sites_domain_unique" ON "comparison_sites" USING btree ("domain");