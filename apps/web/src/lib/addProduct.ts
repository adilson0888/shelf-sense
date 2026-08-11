import type { Batch, Product } from "../types";

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
 * match-search endpoint yet (see Product Add.md's Data section), so every
 * "scan" in this demo resolves to this same canned product. It deliberately
 * matches mocks/products.ts's "Queijo Ralado" (id "p1") — scanning "finds"
 * a product already in the list, same as the approved prototype simulated.
 */
export const MOCK_BARCODE_MATCH = {
  barcode: "7 891234 560123",
  icon: "🧀",
  short: "Queijo Ralado",
  long: "Queijo Parmesão ralado em saquinho",
  minQty: "1",
  fresh: "5",
  qty: "1",
  doesExpire: true,
};

/** Builds the Product (+ optional Batch, per Product Add.md's quantity=0-means-no-batch rule) to save. */
export function buildNewProduct(form: AddProductFormState): { product: Product; batch: Batch | null } {
  const id = `new-${Date.now()}`;
  const qty = Number.parseInt(form.qty, 10) || 0;

  const product: Product = {
    id,
    short_description: form.short.trim(),
    long_description: form.long.trim(),
    aliases: [],
    freshness_threshold_days: form.fresh ? Number.parseInt(form.fresh, 10) : null,
    minimal_quantity: form.minQty ? Number.parseInt(form.minQty, 10) : null,
    does_expire: form.doesExpire,
    barcodes: [],
  };

  const batch: Batch | null =
    qty > 0
      ? {
          id: `${id}-b1`,
          product_id: id,
          quantity: qty,
          expires_on: form.doesExpire && form.expiresOn ? form.expiresOn : null,
        }
      : null;

  return { product, batch };
}
