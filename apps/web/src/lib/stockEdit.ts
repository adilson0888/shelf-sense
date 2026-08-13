import type { TFunctions } from "shelf-sense-i18n/react";
import type { Batch } from "../types";

/**
 * Local, unsaved state for the Stock Edit view (Stock Edit.md) — every add,
 * inline edit, and removal is staged here until Confirm; nothing touches
 * the shared product/batch store until commit (see pages/StockEdit.tsx).
 */
export interface StockEditState {
  productId: string;
  batches: Batch[]; // current draft — additions/edits applied, removals already filtered out
  origIds: string[]; // ids present when the view opened
  origById: Record<string, { quantity: number; expires_on: string | null }>;
  removed: string[]; // ids of ORIGINAL (already-persisted) batches removed this session — see stageRemoval
  sel: string[]; // checked batch ids
  editingQtyId: string | null;
  qtyDraft: string;
  editingExpId: string | null;
  expDraft: string;
  addOpen: boolean;
  newQty: string;
  newExp: string;
  armed: boolean; // true once Save has been clicked once — a second click commits
}

export function openStockEditState(productId: string, batches: Batch[]): StockEditState {
  const draft = batches.map((b) => ({ ...b }));
  return {
    productId,
    batches: draft,
    origIds: draft.map((b) => b.id),
    origById: Object.fromEntries(draft.map((b) => [b.id, { quantity: b.quantity, expires_on: b.expires_on }])),
    removed: [],
    sel: [],
    editingQtyId: null,
    qtyDraft: "",
    editingExpId: null,
    expDraft: "",
    addOpen: false,
    newQty: "",
    newExp: "",
    armed: false,
  };
}

export function toggleSelected(state: StockEditState, id: string): StockEditState {
  return { ...state, sel: state.sel.includes(id) ? state.sel.filter((x) => x !== id) : [...state.sel, id] };
}

export function toggleSelectAll(state: StockEditState): StockEditState {
  const allSelected = state.batches.length > 0 && state.sel.length === state.batches.length;
  return { ...state, sel: allSelected ? [] : state.batches.map((b) => b.id) };
}

/**
 * Filters a batch out of the draft immediately — staged only, same
 * reasoning as Product Edit.md's barcode removal: reversible via Cancel,
 * no confirmation dialog. Only counts toward the removed-summary if it was
 * an already-persisted batch; a batch added this session and then removed
 * just disappears uncounted, since nothing about persisted data actually
 * changes in that case.
 */
export function stageRemoval(state: StockEditState, id: string): StockEditState {
  const wasOriginal = state.origIds.includes(id);
  return {
    ...state,
    batches: state.batches.filter((b) => b.id !== id),
    sel: state.sel.filter((x) => x !== id),
    removed: wasOriginal && !state.removed.includes(id) ? [...state.removed, id] : state.removed,
    armed: false,
  };
}

export function removeSelected(state: StockEditState): StockEditState {
  return state.sel.reduce((s, id) => stageRemoval(s, id), state);
}

export function startEditQty(state: StockEditState, id: string, currentQty: number): StockEditState {
  return { ...state, editingQtyId: id, qtyDraft: String(currentQty) };
}

export function qtyDraftChange(state: StockEditState, value: string): StockEditState {
  return { ...state, qtyDraft: value };
}

/** A committed quantity of 0 stages the row for removal instead of leaving a zero-quantity batch — same rule as Quick Batch Edit's cascading decrease (see Stock Edit.md's Non-functional section on why this is a placeholder, not settled). */
export function commitQtyEdit(state: StockEditState, id: string): StockEditState {
  const parsed = Number.parseInt(state.qtyDraft, 10);
  const fallback = state.batches.find((b) => b.id === id)?.quantity ?? 0;
  const quantity = Number.isNaN(parsed) ? fallback : Math.max(0, parsed);
  const next: StockEditState = {
    ...state,
    editingQtyId: null,
    batches: state.batches.map((b) => (b.id === id ? { ...b, quantity } : b)),
  };
  return quantity <= 0 ? stageRemoval(next, id) : next;
}

export function cancelEditQty(state: StockEditState): StockEditState {
  return { ...state, editingQtyId: null };
}

export function startEditExp(state: StockEditState, id: string, currentExp: string | null): StockEditState {
  return { ...state, editingExpId: id, expDraft: currentExp ?? "" };
}

export function expDraftChange(state: StockEditState, value: string): StockEditState {
  return { ...state, expDraft: value };
}

export function commitExpEdit(state: StockEditState, id: string): StockEditState {
  return {
    ...state,
    editingExpId: null,
    batches: state.batches.map((b) => (b.id === id ? { ...b, expires_on: state.expDraft || null } : b)),
  };
}

export function cancelEditExp(state: StockEditState): StockEditState {
  return { ...state, editingExpId: null };
}

export function toggleAddOpen(state: StockEditState): StockEditState {
  return { ...state, addOpen: !state.addOpen, newQty: "", newExp: "" };
}

export function newQtyChange(state: StockEditState, value: string): StockEditState {
  return { ...state, newQty: value };
}

export function newExpChange(state: StockEditState, value: string): StockEditState {
  return { ...state, newExp: value };
}

export function canAddBatch(state: StockEditState, doesExpire: boolean): boolean {
  const qty = Number.parseInt(state.newQty, 10);
  if (!(qty > 0)) return false;
  if (doesExpire && !state.newExp) return false;
  return true;
}

export function addBatch(state: StockEditState, doesExpire: boolean): StockEditState {
  if (!canAddBatch(state, doesExpire)) return state;
  const batch: Batch = {
    id: `${state.productId}-b${Date.now()}`,
    product_id: state.productId,
    quantity: Number.parseInt(state.newQty, 10),
    expires_on: doesExpire ? state.newExp : null,
  };
  return { ...state, addOpen: false, newQty: "", newExp: "", armed: false, batches: [...state.batches, batch] };
}

export function isNewRow(state: StockEditState, id: string): boolean {
  return !state.origIds.includes(id);
}

export function isEditedRow(state: StockEditState, id: string): boolean {
  if (isNewRow(state, id)) return false;
  const orig = state.origById[id];
  const current = state.batches.find((b) => b.id === id);
  if (!orig || !current) return false;
  return orig.quantity !== current.quantity || orig.expires_on !== current.expires_on;
}

export function hasPendingChanges(state: StockEditState): boolean {
  const addedCount = state.batches.filter((b) => isNewRow(state, b.id)).length;
  const editedCount = state.batches.filter((b) => isEditedRow(state, b.id)).length;
  return addedCount > 0 || editedCount > 0 || state.removed.length > 0;
}

export function armSave(state: StockEditState): StockEditState {
  return { ...state, armed: true };
}

/** "2 batches added, 1 batch updated, 1 batch removed." — only non-zero categories, singular/plural per count via tPlural, joined via formatList (locale-correct separator/conjunction — see packages/i18n/src/format.ts). */
export function saveSummary(state: StockEditState, i18n: Pick<TFunctions, "tPlural" | "formatList">): string {
  const { tPlural, formatList } = i18n;
  const added = state.batches.filter((b) => isNewRow(state, b.id)).length;
  const updated = state.batches.filter((b) => isEditedRow(state, b.id)).length;
  const removed = state.removed.length;
  const bits: string[] = [];
  if (added) bits.push(tPlural("stockEdit.saveSummary.added", added));
  if (updated) bits.push(tPlural("stockEdit.saveSummary.updated", updated));
  if (removed) bits.push(tPlural("stockEdit.saveSummary.removed", removed));
  return `${formatList(bits)}.`;
}
