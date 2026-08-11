// Mirrors specs/Product List.md + specs/Product Add.md's Data sections.
// No backend yet (see apps/web/src/mocks/products.ts) — these are the
// shapes apps/api's future /products endpoints should return.

export interface Product {
  id: string;
  short_description: string; // generic/canonical name — drives identity, search, and display
  long_description: string; // more detail, still generic/brand-free
  aliases: string[]; // alternate names that resolve to this product
  icon?: string; // small representative icon — product-level, not per-batch
  freshness_threshold_days: number | null; // per-product override of the "expiring soon" window; null = follow the global preference
  minimal_quantity: number | null; // per-product low-stock threshold; null = follow the global preference
  does_expire: boolean;
  barcodes: string[];
}

export interface Batch {
  id: string;
  product_id: string;
  quantity: number; // unit count
  expires_on: string | null; // date-only ISO 8601 ("YYYY-MM-DD"); null = does not expire
}

export type FreshnessStatus = "fresh" | "expiring-soon" | "expired" | "no-expiration";
