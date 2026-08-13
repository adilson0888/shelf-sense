import type { CreateProductPayload } from "./api";
import type { ProductListDefaults } from "./productList";

export type AddFlowStep = "idle" | "method" | "scan" | "photo" | "match" | "unlink" | "form";

/** Where the form's current values came from — drives the prefill-note banner. */
export type PrefillSource = "match" | "match-use" | "photo" | null;

export interface AddProductFormState {
  short: string;
  long: string;
  doesExpire: boolean;
  qty: string;
  minQty: string;
  fresh: string;
  expiresOn: string;
}

/**
 * Per Product Add.md: `does_expire` defaults to the user's global "products
 * expire by default" preference (specs/Settings.md) — the user still opts
 * in/out explicitly per product from there.
 */
export function buildBlankForm(defaultDoesExpire: boolean): AddProductFormState {
  return {
    short: "",
    long: "",
    doesExpire: defaultDoesExpire,
    qty: "",
    minQty: "",
    fresh: "",
    expiresOn: "",
  };
}

/**
 * Simulated barcode match — apps/api has no real barcode-lookup or local
 * match-search endpoint yet (see Product Add.md's Data section and
 * specs/Persistence.md's scope note), so every "scan" in this demo resolves
 * to this same canned product regardless of what's actually been saved for
 * real. "Use this"/"add as new" still just prefill the create form with
 * these fixed values — saving always creates a brand-new product either
 * way (see buildCreateProductPayload below), a simplification carried over
 * unchanged from the mocked flow.
 */
export const MOCK_BARCODE_MATCH = {
  barcode: "7 891234 560123",
  short: "Queijo Ralado",
  long: "Queijo Parmesão ralado em saquinho",
  minQty: "1",
  fresh: "5",
  qty: "1",
  doesExpire: true,
};

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
export function buildCreateProductPayload(form: AddProductFormState, defaults: ProductListDefaults): CreateProductPayload {
  return {
    short_description: form.short.trim(),
    long_description: form.long.trim(),
    does_expire: form.doesExpire,
    freshness_threshold_days: form.fresh
      ? Number.parseInt(form.fresh, 10)
      : form.doesExpire
        ? defaults.freshnessThresholdDays
        : null,
    minimal_quantity: form.minQty ? Number.parseInt(form.minQty, 10) : defaults.minimalQuantity,
    quantity: Number.parseInt(form.qty, 10) || 0,
    expires_on: form.doesExpire && form.expiresOn ? form.expiresOn : null,
  };
}
