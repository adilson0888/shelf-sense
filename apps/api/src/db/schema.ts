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

// Schema for specs/Settings.md. Single-user, single active row — no
// per-provider list, no user_id (matches specs/Persistence.md's stated
// single-user scope).
export const preferences = pgTable("preferences", {
  // Fixed singleton id — PATCH always upserts this one row via
  // onConflictDoUpdate; there is never more than one row in this table.
  id: text("id").primaryKey().default("singleton"),
  aiApiBaseUrl: text("ai_api_base_url"), // null = not configured
  aiApiKey: text("ai_api_key"), // plaintext; null = not configured. Never serialized back to a client in full — see routes/preferences.ts.
  aiModel: text("ai_model"), // e.g. "gpt-4o-mini"; null = not configured
  defaultMinimalQuantity: integer("default_minimal_quantity").notNull().default(3), // was apps/web's DEFAULT_MINIMAL_QUANTITY constant
  defaultFreshnessThresholdDays: integer("default_freshness_threshold_days").notNull().default(7), // was apps/web's DEFAULT_FRESHNESS_THRESHOLD_DAYS constant
  defaultDoesExpire: boolean("default_does_expire").notNull().default(true), // was apps/web's BLANK_FORM.doesExpire literal
  language: text("language").notNull().default("en-US"), // "en-US" | "pt-BR" — see specs/i18n.md
});
