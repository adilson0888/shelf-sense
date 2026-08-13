import type { CreateProductPayload } from "./api";

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

export const BLANK_FORM: AddProductFormState = {
  short: "",
  long: "",
  doesExpire: true, // per Product Add.md: required, defaults on — user opts out
  qty: "",
  minQty: "",
  fresh: "",
  expiresOn: "",
};

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
 */
export function buildCreateProductPayload(form: AddProductFormState): CreateProductPayload {
  return {
    short_description: form.short.trim(),
    long_description: form.long.trim(),
    does_expire: form.doesExpire,
    freshness_threshold_days: form.fresh ? Number.parseInt(form.fresh, 10) : null,
    minimal_quantity: form.minQty ? Number.parseInt(form.minQty, 10) : null,
    quantity: Number.parseInt(form.qty, 10) || 0,
    expires_on: form.doesExpire && form.expiresOn ? form.expiresOn : null,
  };
}
