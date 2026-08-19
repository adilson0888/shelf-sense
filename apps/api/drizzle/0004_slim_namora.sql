CREATE SEQUENCE "public"."generated_barcode_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "barcode_id" uuid;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "consumed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_barcode_id_barcodes_id_fk" FOREIGN KEY ("barcode_id") REFERENCES "public"."barcodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- specs/Prices & Product Differentiation.md's Data section: backfill
-- long_description onto every existing barcode whose own description is
-- still blank, before the column is dropped below. There's no "primary
-- code" to pick just one, so a product with several barcodes gets the
-- same text copied onto all of them — duplicate, editable afterward.
-- Products with zero existing barcodes have nowhere for this text to go
-- under the new model; it's dropped for that one disclosed edge case.
UPDATE "barcodes" b
SET "description" = p."long_description"
FROM "products" p
WHERE b."product_id" = p."id"
  AND b."description" = ''
  AND p."long_description" <> '';--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "long_description";