import { boolean, date, integer, numeric, pgSequence, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Schema for the entities defined in specs/Inventory.md, specs/Product
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
    // long_description removed by specs/Prices & Product Differentiation.md —
    // detail text now lives on Barcode.description instead (see below).
    doesExpire: boolean("does_expire").notNull().default(true),
    // null = follow the global preference (see Inventory.md's Non-functional section)
    freshnessThresholdDays: integer("freshness_threshold_days"),
    minimalQuantity: integer("minimal_quantity"),
    // specs/Relative Tracking.md: fixed at creation, never edited afterward.
    // "units" (the default, every pre-existing product) sums Batch.quantity
    // as always; "percentage" products carry no Batch rows at all — their
    // stock lives directly in stockPercent below.
    trackingMode: text("tracking_mode").notNull().default("units"), // "units" | "percentage"
    // 0-100, meaningful only when trackingMode === "percentage"; null otherwise.
    stockPercent: integer("stock_percent"),
    // per-product low-stock threshold in %, meaningful only for percentage
    // tracking; null = follow default_minimal_percentage — same fallback
    // pattern minimalQuantity already uses.
    minimalPercentage: integer("minimal_percentage"),
  },
  (table) => [
    // short_description is the business key for matching/dedup — Product Add.md
    // requires this enforced at save time, not just in application code.
    uniqueIndex("products_short_description_unique").on(table.shortDescription),
  ],
);

// specs/Prices & Product Differentiation.md — hands out the smallest
// possible unique code ("1", "2", "47", …) when a product has no real
// scannable barcode, via nextval() in routes/products.ts. A sequence
// can't repeat a value, so no collision-retry logic is ever needed for
// the generated case, unlike a user-typed/scanned code.
export const generatedBarcodeCodeSeq = pgSequence("generated_barcode_code_seq", { startWith: 1 });

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  // date-only, ISO 8601 ("YYYY-MM-DD"); null = does not expire
  expiresOn: date("expires_on", { mode: "string" }),
  // specs/Prices & Product Differentiation.md — which linked code this
  // purchase was for; null for a batch on a barcode-less legacy product,
  // or where the user skipped picking one. onDelete: "set null" so
  // removing a barcode in Product Edit doesn't take purchase history with it.
  barcodeId: uuid("barcode_id").references(() => barcodes.id, { onDelete: "set null" }),
  // Plain number, no currency code/symbol — see that spec's Non-functional.
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }),
  // True once quantity reached 0 through Stock Edit/Quick Batch Edit —
  // replaces the previous hard-delete-at-zero. GET /products filters these
  // out by default; see routes/products.ts.
  consumed: boolean("consumed").notNull().default(false),
  // specs/Price History.md — when this purchase lot was recorded. Auto-set
  // at insert, never user-editable. Pre-existing rows are backfilled to
  // this migration's run time, not their real purchase date — historical
  // accuracy only starts going forward from this migration.
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  // specs/Barcode Scanner & Product info scrape.md — Tavily search API key,
  // used only as the Open-Food-Facts-miss fallback for barcode lookups.
  // Same never-echoed-in-full convention as aiApiKey.
  tavilyApiKey: text("tavily_api_key"),
  defaultMinimalQuantity: integer("default_minimal_quantity").notNull().default(3), // was apps/web's DEFAULT_MINIMAL_QUANTITY constant
  defaultFreshnessThresholdDays: integer("default_freshness_threshold_days").notNull().default(7), // was apps/web's DEFAULT_FRESHNESS_THRESHOLD_DAYS constant
  defaultDoesExpire: boolean("default_does_expire").notNull().default(true), // was apps/web's BLANK_FORM.doesExpire literal
  language: text("language").notNull().default("en-US"), // "en-US" | "pt-BR" — see specs/i18n.md
  // specs/Relative Tracking.md's low-% threshold fallback for
  // percentage-tracked products — editable via Settings' Default Options.
  defaultMinimalPercentage: integer("default_minimal_percentage").notNull().default(20),
});
