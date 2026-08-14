import type { TFunctions } from "shelf-sense-i18n/react";
import type { Batch, FreshnessStatus, Product } from "../types";
import { formatExpiryLabel, freshnessStatus } from "./freshness";

/** specs/Settings.md's Default Options, read live via usePreferencesStore. */
export interface InventoryDefaults {
  freshnessThresholdDays: number;
  minimalQuantity: number;
}

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

export function enrichProduct(
  product: Product,
  batches: Batch[],
  today: Date,
  defaults: InventoryDefaults,
  i18n: Pick<TFunctions, "t" | "tPlural" | "formatDate">,
): EnrichedProduct {
  const sortedBatches: EnrichedBatch[] = sortBatchesByExpiry(batches)
    .map((b) => ({
      ...b,
      status: freshnessStatus(b.expires_on, product.freshness_threshold_days, defaults.freshnessThresholdDays, today),
      qtyLabel: `×${b.quantity}`,
      expiryLabel: formatExpiryLabel(b.expires_on, product.freshness_threshold_days, defaults.freshnessThresholdDays, today, i18n),
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
    isLow: totalQty < (product.minimal_quantity ?? defaults.minimalQuantity),
  };
}

/**
 * Narrowed to just the two fields this actually reads (rather than
 * `EnrichedProduct`) so callers that don't need batch/freshness rollups —
 * e.g. Product List, which shows every product regardless of stock — can
 * call this directly on a raw `Product` without enriching first.
 * `EnrichedProduct` still satisfies this shape, so existing callers are
 * unaffected.
 */
export function matchesSearch(product: Pick<Product, "short_description" | "aliases">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [product.short_description, ...product.aliases].join(" ").toLowerCase().includes(q);
}

/**
 * specs/Inventory.md: this screen is "what's on the shelf," not a general
 * product catalog — a product with nothing in stock (0 total quantity
 * across all batches, including products with no batches at all, e.g. one
 * saved via Product Add with quantity left blank) has no place here.
 */
export function isVisibleInInventory(product: EnrichedProduct): boolean {
  return product.totalQty > 0;
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
// day-count is accurate to promise in the header. Built from `t` inline
// (not a module-level constant) so labels react to locale changes at
// runtime, same reasoning as lib/menu.ts's getMenuItems().
function groupDefs(t: TFunctions["t"]): { key: FreshnessStatus; label: string }[] {
  return [
    { key: "expired", label: t("freshnessStatus.expired") },
    { key: "expiring-soon", label: t("freshnessStatus.expiringSoon") },
    { key: "fresh", label: t("freshnessStatus.fresh") },
    { key: "no-expiration", label: t("freshnessStatus.noExpiration") },
  ];
}

export function groupByStatus(products: EnrichedProduct[], t: TFunctions["t"]): ProductGroup[] {
  return groupDefs(t)
    .map(({ key, label }) => {
      const list = products
        .filter((p) => p.status === key)
        .sort((a, b) => {
          const at = a.soonestExpiresOn ? new Date(a.soonestExpiresOn).getTime() : Infinity;
          const bt = b.soonestExpiresOn ? new Date(b.soonestExpiresOn).getTime() : Infinity;
          return at - bt || a.short_description.localeCompare(b.short_description);
        });
      return { key, label, status: key, count: list.length, products: list };
    })
    .filter((g) => g.count > 0);
}

export function groupAlphabetically(products: EnrichedProduct[], t: TFunctions["t"]): ProductGroup[] {
  const list = products.slice().sort((a, b) => a.short_description.localeCompare(b.short_description));
  if (list.length === 0) return [];
  return [{ key: "alpha", label: t("inventoryGroups.alphabetical"), status: "alpha", count: list.length, products: list }];
}
