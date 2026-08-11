import type { Batch, FreshnessStatus, Product } from "../types";
import { formatExpiryLabel, freshnessStatus } from "./freshness";

/** Stand-in for the not-yet-built user preferences feature (see Product.minimal_quantity). */
export const DEFAULT_MINIMAL_QUANTITY = 3;

export interface EnrichedBatch extends Batch {
  status: FreshnessStatus;
  qtyLabel: string;
  expiryLabel: string;
}

export interface EnrichedProduct extends Product {
  batches: EnrichedBatch[];
  totalQty: number;
  status: FreshnessStatus; // soonest across batches
  soonestExpiresOn: string | null;
  isLow: boolean;
}

const STATUS_RANK: Record<FreshnessStatus, number> = {
  expired: 0,
  "expiring-soon": 1,
  fresh: 2,
  "no-expiration": 3,
};

/** Soonest-expiring first, does-not-expire batches last. The one depletion/display order this app uses everywhere — Quick Batch Edit's decrease logic reuses this too (see quickBatchEdit.ts). */
export function sortBatchesByExpiry<T extends Batch>(batches: T[]): T[] {
  return batches.slice().sort((a, b) => {
    const at = a.expires_on ? new Date(a.expires_on).getTime() : Infinity;
    const bt = b.expires_on ? new Date(b.expires_on).getTime() : Infinity;
    return at - bt;
  });
}

export function enrichProduct(product: Product, batches: Batch[], today: Date): EnrichedProduct {
  const sortedBatches: EnrichedBatch[] = sortBatchesByExpiry(batches)
    .map((b) => ({
      ...b,
      status: freshnessStatus(b.expires_on, product.freshness_threshold_days, today),
      qtyLabel: `×${b.quantity}`,
      expiryLabel: formatExpiryLabel(b.expires_on, product.freshness_threshold_days, today),
    }));

  const totalQty = sortedBatches.reduce((sum, b) => sum + b.quantity, 0);
  const soonest = sortedBatches.reduce<EnrichedBatch | null>(
    (best, b) => (!best || STATUS_RANK[b.status] < STATUS_RANK[best.status] ? b : best),
    null,
  );

  return {
    ...product,
    batches: sortedBatches,
    totalQty,
    status: soonest?.status ?? "no-expiration",
    soonestExpiresOn: soonest?.expires_on ?? null,
    isLow: totalQty < (product.minimal_quantity ?? DEFAULT_MINIMAL_QUANTITY),
  };
}

export function matchesSearch(product: EnrichedProduct, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [product.short_description, ...product.aliases].join(" ").toLowerCase().includes(q);
}

export type ListScope = "all" | "attention" | "low";

export function matchesScope(product: EnrichedProduct, scope: ListScope): boolean {
  if (scope === "low") return product.isLow;
  if (scope === "attention") return product.status === "expired" || product.status === "expiring-soon";
  return true;
}

export interface ProductGroup {
  key: string;
  label: string;
  status: FreshnessStatus | "alpha";
  count: number;
  products: EnrichedProduct[];
}

// Labeled generically ("Expiring soon", not "Use within N days") because the
// threshold is per-product (Product.freshness_threshold_days) — a single
// group can contain products with different actual thresholds, so no one
// day-count is accurate to promise in the header.
const GROUP_DEFS: { key: FreshnessStatus; label: string }[] = [
  { key: "expired", label: "Expired" },
  { key: "expiring-soon", label: "Expiring soon" },
  { key: "fresh", label: "Fresh" },
  { key: "no-expiration", label: "No expiry" },
];

export function groupByStatus(products: EnrichedProduct[]): ProductGroup[] {
  return GROUP_DEFS.map(({ key, label }) => {
    const list = products
      .filter((p) => p.status === key)
      .sort((a, b) => {
        const at = a.soonestExpiresOn ? new Date(a.soonestExpiresOn).getTime() : Infinity;
        const bt = b.soonestExpiresOn ? new Date(b.soonestExpiresOn).getTime() : Infinity;
        return at - bt || a.short_description.localeCompare(b.short_description);
      });
    return { key, label, status: key, count: list.length, products: list };
  }).filter((g) => g.count > 0);
}

export function groupAlphabetically(products: EnrichedProduct[]): ProductGroup[] {
  const list = products.slice().sort((a, b) => a.short_description.localeCompare(b.short_description));
  if (list.length === 0) return [];
  return [{ key: "alpha", label: "All products, A–Z", status: "alpha", count: list.length, products: list }];
}
