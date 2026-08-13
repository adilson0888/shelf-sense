import { boolean, date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Schema for the entities defined in specs/Product List.md, specs/Product
 * Add.md, and specs/Product Edit.md — see specs/Persistence.md for the
 * decisions behind engine/ORM/migration choices.
 *
 * IDs are generated in application code (crypto.randomUUID(), see
 * src/routes/products.ts) rather than via a DB-side default, so this schema
 * has no dependency on a Postgres extension (pgcrypto/uuid-ossp).
 */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description").notNull().default(""),
    doesExpire: boolean("does_expire").notNull().default(true),
    // null = follow the global preference (see Product List.md's Non-functional section)
    freshnessThresholdDays: integer("freshness_threshold_days"),
    minimalQuantity: integer("minimal_quantity"),
  },
  (table) => [
    // short_description is the business key for matching/dedup — Product Add.md
    // requires this enforced at save time, not just in application code.
    uniqueIndex("products_short_description_unique").on(table.shortDescription),
  ],
);

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  // date-only, ISO 8601 ("YYYY-MM-DD"); null = does not expire
  expiresOn: date("expires_on", { mode: "string" }),
});

export const productAliases = pgTable(
  "product_aliases",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (table) => [
    // an alias resolves to exactly one product, same global-uniqueness shape as barcodes
    uniqueIndex("product_aliases_alias_unique").on(table.alias),
  ],
);

export const barcodes = pgTable(
  "barcodes",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
  },
  (table) => [
    // enforces "a barcode belongs to one product at a time" at the DB layer
    // (Product Add.md's invariant), not just application logic.
    uniqueIndex("barcodes_code_unique").on(table.code),
  ],
);
