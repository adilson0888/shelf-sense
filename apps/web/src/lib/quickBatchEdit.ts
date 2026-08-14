import type { Batch } from "../types";
import { sortBatchesByExpiry } from "./inventory";

/**
 * Local, unsaved state for one open Quick Batch Edit modal (Quick Batch
 * Edit.md). The steppers and the click-to-type total both move `target`;
 * nothing touches real Product/Batch data until Save — see applyQuickEdit.
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
}

export function openQuickEditState(productId: string, total: number, mode: "units" | "percentage" = "units"): QuickEditState {
  return { productId, mode, base: total, target: total, editing: false, draft: String(total), addExpiresOn: "" };
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
  return { ...state, target: state.base, draft: String(state.base), editing: false, addExpiresOn: "" };
}

/**
 * Applies a Quick Batch Edit save to one product's batches (Quick Batch
 * Edit.md's Data section). A negative net delta subtracts from the
 * soonest-expiring batch first (sortBatchesByExpiry — the same order
 * Inventory already computes), cascading into the next batch as needed;
 * anything emptied to 0 is dropped. A positive net delta appends exactly
 * one new batch — the intermediate stepper taps that got the user to that
 * final number don't each create their own record, only the net result at
 * Save does.
 */
export function applyQuickEdit(
  productBatches: Batch[],
  productId: string,
  doesExpire: boolean,
  delta: number,
  addExpiresOn: string,
): Batch[] {
  const addQty = Math.max(0, delta);
  let toRemove = Math.max(0, -delta);

  const reduced = sortBatchesByExpiry(productBatches)
    .map((b) => {
      const take = Math.min(toRemove, b.quantity);
      toRemove -= take;
      return { ...b, quantity: b.quantity - take };
    })
    .filter((b) => b.quantity > 0);

  if (addQty > 0) {
    reduced.push({
      id: `${productId}-b${Date.now()}`,
      product_id: productId,
      quantity: addQty,
      expires_on: doesExpire && addExpiresOn ? addExpiresOn : null,
    });
  }

  return reduced;
}
