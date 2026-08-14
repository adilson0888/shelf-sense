import type { Product } from "../types";
import type { InventoryDefaults } from "./inventory";

// Reuses inventory.ts's InventoryDefaults directly (identical shape — both
// pages resolve the same two Settings.md global defaults) rather than
// declaring a parallel duplicate type.
export type ProductListDefaults = InventoryDefaults;

/**
 * "Occasional" is a derived split, not a stored field (specs/Product
 * List.md's Data section) — a product is Occasional only when its
 * `minimal_quantity` is explicitly `0`; every other case (a positive
 * number, or `null` following a non-zero global default) is Regular. No
 * parallel boolean field to keep in sync — this reuses the existing
 * low-stock-threshold field as the signal.
 */
export function isRegular(product: Product, defaults: ProductListDefaults): boolean {
  return effectiveMinimalQuantity(product, defaults) > 0;
}

export function effectiveMinimalQuantity(product: Product, defaults: ProductListDefaults): number {
  return product.minimal_quantity ?? defaults.minimalQuantity;
}

export function effectiveFreshnessThresholdDays(product: Product, defaults: ProductListDefaults): number | null {
  return product.does_expire ? (product.freshness_threshold_days ?? defaults.freshnessThresholdDays) : null;
}

export type TypeFilter = "all" | "regular" | "occasional";

export function matchesTypeFilter(product: Product, filter: TypeFilter, defaults: ProductListDefaults): boolean {
  if (filter === "regular") return isRegular(product, defaults);
  if (filter === "occasional") return !isRegular(product, defaults);
  return true;
}

export type ExpiryFilter = "all" | "expires" | "no-expiry";

export function matchesExpiryFilter(product: Product, filter: ExpiryFilter): boolean {
  if (filter === "expires") return product.does_expire;
  if (filter === "no-expiry") return !product.does_expire;
  return true;
}

/** Default sort order — alphabetical by short_description, locale-aware per the active app locale (specs/Product List.md's acceptance criteria). */
export function compareByName(a: Product, b: Product, locale: string): number {
  return a.short_description.localeCompare(b.short_description, locale);
}
