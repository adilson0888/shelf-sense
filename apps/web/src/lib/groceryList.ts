import type { Product } from "../types";
import type { EnrichedProduct, InventoryDefaults } from "./inventory";

// Reuses inventory.ts's InventoryDefaults directly — same shape Product
// List.md's own lib/productList.ts already reuses for the identical reason
// (both pages resolve the same Settings.md global defaults).
export type GroceryListDefaults = InventoryDefaults;

export function effectiveMinimalQuantity(product: Product, defaults: GroceryListDefaults): number {
  return product.minimal_quantity ?? defaults.minimalQuantity;
}

export function effectiveMinimalPercentage(product: Product, defaults: GroceryListDefaults): number {
  return product.minimal_percentage ?? defaults.minimalPercentage;
}

/**
 * Regular vs. Occasional — specs/Product List.md's derived split (a product
 * is Occasional only when its effective low-stock threshold is explicitly
 * `0`), extended here to cover percentage-tracked products the same way
 * units-tracked ones already work. `lib/productList.ts`'s own `isRegular`
 * predates specs/Relative Tracking.md landing for real and only ever checks
 * `minimal_quantity` — not duplicated/fixed here, since changing that
 * function's behavior would also change Product List's own Regular/
 * Occasional counts, a different spec's concern.
 */
export function isRegular(product: Product, defaults: GroceryListDefaults): boolean {
  return product.tracking_mode === "percentage"
    ? effectiveMinimalPercentage(product, defaults) > 0
    : effectiveMinimalQuantity(product, defaults) > 0;
}

/**
 * specs/Grocery List.md's Low stock tile: a Regular product currently below
 * its effective threshold. Reuses `EnrichedProduct.isLow` (lib/inventory.ts)
 * as-is — the same computed condition driving Inventory's own "LOW" badge
 * and "Low stock" scope tile — rather than re-deriving the </=/<= split,
 * just additionally gated on Regular so an Occasional product (whose
 * threshold is 0) never counts as "low" here even in the percentage
 * edge case where `stock_percent <= 0` would otherwise be trivially true.
 */
export function isLowStock(product: EnrichedProduct, defaults: GroceryListDefaults): boolean {
  return isRegular(product, defaults) && product.isLow;
}

/**
 * specs/Grocery List.md's Occasional tile: an Occasional product (effective
 * threshold explicitly 0 — see isRegular) that's currently at zero stock.
 * An Occasional product that still has stock left never appears here —
 * nothing to buy yet.
 */
export function isOutOfStockOccasional(product: EnrichedProduct, defaults: GroceryListDefaults): boolean {
  return !isRegular(product, defaults) && product.totalQty === 0;
}

export type GroceryScope = "all" | "low" | "occasional";

/** "All" is the union of Low stock and Occasional — every scope this screen ever surfaces. */
export function isGroceryCandidate(product: EnrichedProduct, defaults: GroceryListDefaults): boolean {
  return isLowStock(product, defaults) || isOutOfStockOccasional(product, defaults);
}

export function matchesGroceryScope(product: EnrichedProduct, scope: GroceryScope, defaults: GroceryListDefaults): boolean {
  if (scope === "low") return isLowStock(product, defaults);
  if (scope === "occasional") return isOutOfStockOccasional(product, defaults);
  return isGroceryCandidate(product, defaults);
}

/** Default sort — alphabetical by short_description, locale-aware, same default Product List.md uses (specs/Grocery List.md flags this as an assumption, not a resolved design decision). */
export function compareByName(a: Product, b: Product, locale: string): number {
  return a.short_description.localeCompare(b.short_description, locale);
}
