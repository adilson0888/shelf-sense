import type { BarcodeLookupResult, CreateProductPayload, UpdateProductPayload } from "./api";
import type { InventoryDefaults } from "./inventory";
import type { Product } from "../types";

export interface AddProductFormState {
  short: string;
  // specs/Prices & Product Differentiation.md — replaces the old
  // product-level `long`: a description now always lives on the code, not
  // the product. `codeChoice` is "generate" whenever the user picked "I
  // don't have a code" — `code` is only sent when it's "provided".
  code: string;
  codeChoice: "provided" | "generate";
  codeDescription: string;
  doesExpire: boolean;
  qty: string;
  minQty: string;
  fresh: string;
  expiresOn: string;
  price: string; // draft text for the optional initial-batch price, relevant only when qty > 0
  // specs/Relative Tracking.md — fixed at creation, never edited afterward.
  trackingMode: "units" | "percentage";
  stockPercent: string; // draft text for the "current %" field, relevant only when trackingMode === "percentage"
  minPercent: string; // draft text for the low-% threshold, relevant only when trackingMode === "percentage"
  // specs/Barcode Scanner & Product info scrape.md — a barcode scanned on
  // the way to this form that didn't match an existing product. null on
  // every other entry path (unsupported browser, cancelled scan). Drives
  // whether "Link to existing product" is offered (see AddProduct.tsx) and
  // pre-fills `code`/locks `codeChoice` to "provided".
  barcode: string | null;
  // Which lookup provider (if any) filled short/codeDescription below —
  // drives the prefill-note banner. null whenever barcode is null, or a
  // scan found nothing usable.
  prefillSource: "open-food-facts" | "tavily" | null;
}

/**
 * Per Product Add.md: `does_expire` defaults to the user's global "products
 * expire by default" preference (specs/Settings.md) — the user still opts
 * in/out explicitly per product from there. `trackingMode` always starts
 * "units" — the user opts into percentage tracking explicitly, same shape
 * as does_expire's own default-then-opt-out pattern. `codeChoice` defaults
 * to "provided" (an empty, typeable code field) rather than "generate" —
 * generation is an explicit opt-out, not the default, per specs/Prices &
 * Product Differentiation.md's "I don't have a code" toggle.
 */
export function buildBlankForm(defaultDoesExpire: boolean): AddProductFormState {
  return {
    short: "",
    code: "",
    codeChoice: "provided",
    codeDescription: "",
    doesExpire: defaultDoesExpire,
    qty: "",
    minQty: "",
    fresh: "",
    expiresOn: "",
    price: "",
    trackingMode: "units",
    stockPercent: "100",
    minPercent: "",
    barcode: null,
    prefillSource: null,
  };
}

/**
 * A blank form carrying a scanned-but-unmatched barcode, optionally
 * prefilled with whatever GET /products/lookup-barcode found (partial
 * results — either field alone — are applied as-is; the rest stays blank
 * for the user to fill in, per the spec's "even partial info still fills
 * the form" rule). The lookup's `long_description` (if any) now prefills
 * this code's own description, not a product-level field.
 */
export function buildScannedForm(defaultDoesExpire: boolean, barcode: string, lookup: BarcodeLookupResult): AddProductFormState {
  return {
    ...buildBlankForm(defaultDoesExpire),
    short: lookup.short_description ?? "",
    codeDescription: lookup.long_description ?? "",
    barcode,
    code: barcode,
    codeChoice: "provided",
    prefillSource: lookup.source,
  };
}

/**
 * Builds the POST /products request body — the server owns id assignment
 * and, per Product Add.md's quantity=0-means-no-batch rule, decides
 * whether a batch gets created at all (quantity 0 here just means "don't
 * ask for one").
 *
 * `minimal_quantity`/`freshness_threshold_days` left blank are snapshotted
 * to the current global default (`defaults`) rather than saved as `null` —
 * a deliberate Add-time-only behavior (Product Edit's own blank → `null`
 * handling, which keeps following the live global default forever, is
 * unchanged — see Product Add.md's acceptance criteria). The freshness
 * threshold only gets the default when `does_expire` is true; the field
 * isn't shown at all otherwise, so `null` still means "not applicable"
 * there, same as before.
 */
export function buildCreateProductPayload(form: AddProductFormState, defaults: InventoryDefaults): CreateProductPayload {
  const barcode = {
    code: form.codeChoice === "generate" ? null : form.code.trim(),
    description: form.codeDescription.trim(),
  };
  const price = form.price.trim() ? Number.parseFloat(form.price) : null;
  // specs/Relative Tracking.md: a percentage-tracked product never expires,
  // has no quantity/expires_on batch fields, and stores its stock directly
  // as stock_percent — a completely different shape from the units branch
  // below, not just a couple of overridden fields.
  if (form.trackingMode === "percentage") {
    return {
      short_description: form.short.trim(),
      does_expire: false,
      freshness_threshold_days: null,
      minimal_quantity: null,
      quantity: 0,
      expires_on: null,
      tracking_mode: "percentage",
      stock_percent: clampPercent(Number.parseInt(form.stockPercent, 10) || 0),
      minimal_percentage: form.minPercent ? clampPercent(Number.parseInt(form.minPercent, 10)) : defaults.minimalPercentage,
      barcode,
      price: null,
    };
  }
  return {
    short_description: form.short.trim(),
    does_expire: form.doesExpire,
    freshness_threshold_days: form.fresh
      ? Number.parseInt(form.fresh, 10)
      : form.doesExpire
        ? defaults.freshnessThresholdDays
        : null,
    minimal_quantity: form.minQty ? Number.parseInt(form.minQty, 10) : defaults.minimalQuantity,
    quantity: Number.parseInt(form.qty, 10) || 0,
    expires_on: form.doesExpire && form.expiresOn ? form.expiresOn : null,
    tracking_mode: "units",
    stock_percent: null,
    minimal_percentage: null,
    barcode,
    price,
  };
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * Builds the PATCH /products/:id body for "Link to existing product"
 * (specs/Barcode Scanner & Product info scrape.md) — every field of
 * `target` unchanged except its barcode list, which gains `code` plus
 * whatever description the user had typed for it on this form. No
 * `other_product_updates`/unlink needed: this flow is only reachable after
 * the local-match check already confirmed `code` belongs to no product
 * yet, so there's nothing to move it away from.
 */
export function buildLinkBarcodePayload(target: Product, code: string, description: string): UpdateProductPayload {
  return {
    short_description: target.short_description,
    does_expire: target.does_expire,
    minimal_quantity: target.minimal_quantity,
    freshness_threshold_days: target.freshness_threshold_days,
    minimal_percentage: target.minimal_percentage,
    aliases: target.aliases,
    barcodes: [...target.barcodes.map((b) => ({ code: b.code, description: b.description })), { code, description }],
    other_product_updates: [],
  };
}
