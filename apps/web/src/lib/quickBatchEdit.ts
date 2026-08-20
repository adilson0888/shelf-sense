import type { Batch } from "../types";
import { sortBatchesByExpiry } from "./inventory";

/**
 * Local, unsaved state for one open Quick Batch Edit modal (Quick Batch
 * Edit.md). The steppers and the click-to-type total both move `target`;
 * nothing touches real Product/Batch data until Save — see planQuickEdit.
 */
export interface QuickEditState {
  productId: string;
  /** specs/Relative Tracking.md: clamps target's upper bound at 100 for "percentage", uncapped for "units". */
  mode: "units" | "percentage";
  base: number; // stored total (or stock_percent) when the modal opened
  target: number; // pending target quantity (or percentage)
  editing: boolean; // true while the total is a typable input instead of the click-to-edit label
  draft: string; // the input's raw text while editing
  addExpiresOn: string; // expires_on for the new batch, relevant only when mode is "units" and target > base
  // specs/Prices & Product Differentiation.md — optional, relevant only
  // alongside a new batch (target > base).
  addPrice: string;
  // Which of this product's linked codes the new batch is for — only ever
  // shown/settable when the product has more than one.
  addBarcodeId: string | null;
}

export function openQuickEditState(productId: string, total: number, mode: "units" | "percentage" = "units"): QuickEditState {
  return {
    productId,
    mode,
    base: total,
    target: total,
    editing: false,
    draft: String(total),
    addExpiresOn: "",
    addPrice: "",
    addBarcodeId: null,
  };
}

function clampTarget(mode: "units" | "percentage", n: number): number {
  return mode === "percentage" ? Math.min(100, Math.max(0, n)) : Math.max(0, n);
}

export function bumpQuickEdit(state: QuickEditState, delta: number): QuickEditState {
  const target = clampTarget(state.mode, state.target + delta);
  return { ...state, target, draft: String(target) };
}

export function commitQuickEditDraft(state: QuickEditState): QuickEditState {
  const n = clampTarget(state.mode, Number.parseInt(state.draft, 10) || 0);
  return { ...state, target: n, draft: String(n), editing: false };
}

export function resetQuickEdit(state: QuickEditState): QuickEditState {
  return { ...state, target: state.base, draft: String(state.base), editing: false, addExpiresOn: "", addPrice: "", addBarcodeId: null };
}

export interface QuickEditPlan {
  /** Existing batches whose quantity needs to change — apps/api's PATCH /products/:id/batches/:id, one call per entry. Reaching 0 marks it consumed server-side. */
  updates: { batchId: string; quantity: number }[];
  /** A new batch to create — apps/api's POST /products/:id/batches — or null when the net delta isn't positive. */
  create: { quantity: number; expires_on: string | null; barcode_id: string | null; price: number | null } | null;
}

/**
 * Plans a Quick Batch Edit save against one product's batches (Quick Batch
 * Edit.md's Data section) — the caller (Inventory.tsx) turns this into real
 * apps/api calls (specs/Prices & Product Differentiation.md; neither
 * endpoint existed before that spec). A negative net delta subtracts from
 * the soonest-expiring batch first (sortBatchesByExpiry — the same order
 * Inventory already computes), cascading into the next batch as needed. A
 * positive net delta plans exactly one new batch — the intermediate
 * stepper taps that got the user to that final number don't each create
 * their own record, only the net result at Save does.
 */
export function planQuickEdit(
  productBatches: Batch[],
  doesExpire: boolean,
  delta: number,
  addExpiresOn: string,
  addPrice: string,
  addBarcodeId: string | null,
): QuickEditPlan {
  const addQty = Math.max(0, delta);
  let toRemove = Math.max(0, -delta);

  const updates: QuickEditPlan["updates"] = [];
  for (const b of sortBatchesByExpiry(productBatches)) {
    if (toRemove <= 0) break;
    const take = Math.min(toRemove, b.quantity);
    if (take <= 0) continue;
    toRemove -= take;
    updates.push({ batchId: b.id, quantity: b.quantity - take });
  }

  return {
    updates,
    create:
      addQty > 0
        ? {
            quantity: addQty,
            expires_on: doesExpire && addExpiresOn ? addExpiresOn : null,
            barcode_id: addBarcodeId,
            price: addPrice.trim() ? Number.parseFloat(addPrice) : null,
          }
        : null,
  };
}

/**
 * specs/Price History for % tracked products.md — a percentage-tracked
 * product's stock_percent is always overwritten directly (Inventory.tsx's
 * quickSave), never cascaded through batches; this only plans the optional
 * symbolic Batch that purchase becomes when the user entered a price
 * alongside a positive delta. quantity is the % delta itself (e.g. a +25%
 * top-up plans quantity: 25) — a historical figure, never summed into any
 * total. expires_on is always null: a percentage-tracked product never
 * expires. A blank price, or a zero/negative delta, plans no batch at all —
 * unlike units, price presence is what decides whether a batch is created,
 * not the delta's sign alone.
 */
export function planPercentBatch(delta: number, addPrice: string, addBarcodeId: string | null): QuickEditPlan["create"] {
  if (delta <= 0 || !addPrice.trim()) return null;
  return {
    quantity: delta,
    expires_on: null,
    barcode_id: addBarcodeId,
    price: Number.parseFloat(addPrice),
  };
}
