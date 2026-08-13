import type { TFunctions } from "shelf-sense-i18n/react";
import type { UpdateProductPayload } from "./api";
import type { Barcode, Product } from "../types";

/**
 * Local, unsaved state for one open Product Edit view (Product Edit.md).
 * Every field edit, alias/barcode add/remove, and cross-product "move"
 * lives here until Save is confirmed — nothing touches the real Product
 * (or another product) until then. See buildSaveResult.
 */
export interface ProductEditState {
  productId: string;
  /** JSON Snapshot of the product's editable slice as loaded — the change-detection and save-summary baseline. */
  orig: string;

  short: string;
  long: string;
  doesExpire: boolean;
  minQty: string;
  fresh: string;

  aliases: string[];
  newAlias: string;
  /** Hard-error message: the new alias collides with another product's own short_description. */
  aliasError: string | null;
  /** Hard-error message: short_description collides with another product's — set only when arming Save. */
  shortError: string | null;

  barcodes: Barcode[];
  selectedBarcodeIds: string[];
  editingBarcodeId: string | null;
  addBarcodeOpen: boolean;
  newBarcodeDesc: string;
  newBarcodeCode: string;

  // Staged cross-product effects — applied to the OTHER product(s) only at
  // Save, atomically alongside this product's own changes.
  unlinkBarcodesFrom: { productId: string; code: string }[];
  unlinkAliasFrom: { productId: string; alias: string }[];

  confirm: EditConfirm;
  /** True while Save is showing "Confirm?" — the confirm-to-commit pattern (see shelf-sense-ds's Button "confirm" variant). */
  saveArmed: boolean;
}

export type EditConfirm =
  | { type: "barcode"; code: string; description: string; ownerId: string; ownerName: string }
  | { type: "alias"; alias: string; ownerId: string; ownerName: string }
  | null;

interface Snapshot {
  short: string;
  long: string;
  doesExpire: boolean;
  minQty: string;
  fresh: string;
  aliases: string[];
  barcodes: { code: string; description: string }[];
}

function snapshot(s: Pick<ProductEditState, "short" | "long" | "doesExpire" | "minQty" | "fresh" | "aliases" | "barcodes">): Snapshot {
  return {
    short: s.short,
    long: s.long,
    doesExpire: s.doesExpire,
    minQty: s.minQty,
    fresh: s.fresh,
    aliases: s.aliases,
    barcodes: s.barcodes.map((b) => ({ code: b.code, description: b.description })),
  };
}

export function openProductEditState(product: Product): ProductEditState {
  const base = {
    short: product.short_description,
    long: product.long_description,
    doesExpire: product.does_expire,
    minQty: product.minimal_quantity == null ? "" : String(product.minimal_quantity),
    fresh: product.freshness_threshold_days == null ? "" : String(product.freshness_threshold_days),
    aliases: product.aliases.slice(),
    barcodes: product.barcodes.map((b) => ({ ...b })),
  };
  return {
    productId: product.id,
    orig: JSON.stringify(snapshot(base)),
    ...base,
    newAlias: "",
    aliasError: null,
    shortError: null,
    selectedBarcodeIds: [],
    editingBarcodeId: null,
    addBarcodeOpen: false,
    newBarcodeDesc: "",
    newBarcodeCode: "",
    unlinkBarcodesFrom: [],
    unlinkAliasFrom: [],
    confirm: null,
    saveArmed: false,
  };
}

export function hasChanges(state: ProductEditState): boolean {
  return JSON.stringify(snapshot(state)) !== state.orig;
}

export function isRenamed(state: ProductEditState): boolean {
  const orig: Snapshot = JSON.parse(state.orig);
  const trimmed = state.short.trim();
  return trimmed.length > 0 && trimmed !== orig.short;
}

// --- Field edits — every one disarms a pending Save confirm; the user's
// mind changing counts as "something else happened" per the spec. ---------

export function setField(state: ProductEditState, key: "short" | "long" | "minQty" | "fresh", value: string): ProductEditState {
  return { ...state, [key]: value, saveArmed: false, shortError: key === "short" ? null : state.shortError };
}

export function setDoesExpire(state: ProductEditState, value: boolean): ProductEditState {
  return { ...state, doesExpire: value, saveArmed: false };
}

// --- Aliases ----------------------------------------------------------

export function setNewAlias(state: ProductEditState, value: string): ProductEditState {
  return { ...state, newAlias: value, aliasError: null };
}

/**
 * Adds the pending alias if it's free, flags a hard error if it collides
 * with another product's own short_description (can't reassign someone's
 * primary name via an alias — Product Edit.md's ASSUMPTION), or opens the
 * same move-and-confirm flow as a barcode conflict if it collides with
 * another product's alias.
 */
export function addAlias(state: ProductEditState, allProducts: Product[], t: TFunctions["t"]): ProductEditState {
  const value = state.newAlias.trim();
  if (!value) return state;
  const lower = value.toLowerCase();
  if (state.aliases.some((a) => a.toLowerCase() === lower)) {
    return { ...state, newAlias: "" };
  }
  const shortOwner = allProducts.find(
    (p) => p.id !== state.productId && p.short_description.trim().toLowerCase() === lower,
  );
  if (shortOwner) {
    return {
      ...state,
      aliasError: t("productEdit.aliasCollisionWithOwnName", { alias: value, ownerName: shortOwner.short_description }),
    };
  }
  const aliasOwner = allProducts.find(
    (p) => p.id !== state.productId && p.aliases.some((a) => a.toLowerCase() === lower),
  );
  if (aliasOwner) {
    return { ...state, confirm: { type: "alias", alias: value, ownerId: aliasOwner.id, ownerName: aliasOwner.short_description } };
  }
  return { ...state, aliases: [...state.aliases, value], newAlias: "", aliasError: null, saveArmed: false };
}

export function confirmAliasMove(state: ProductEditState): ProductEditState {
  if (!state.confirm || state.confirm.type !== "alias") return state;
  const { alias, ownerId } = state.confirm;
  return {
    ...state,
    aliases: [...state.aliases, alias],
    unlinkAliasFrom: [...state.unlinkAliasFrom, { productId: ownerId, alias }],
    newAlias: "",
    confirm: null,
    saveArmed: false,
  };
}

/** No confirmation needed — an alias removal is just staged, fully reversible via Cancel. */
export function removeAlias(state: ProductEditState, alias: string): ProductEditState {
  return { ...state, aliases: state.aliases.filter((a) => a !== alias), saveArmed: false };
}

// --- Barcodes -----------------------------------------------------------

export function toggleBarcodeSelected(state: ProductEditState, id: string): ProductEditState {
  const selected = state.selectedBarcodeIds.includes(id)
    ? state.selectedBarcodeIds.filter((x) => x !== id)
    : [...state.selectedBarcodeIds, id];
  return { ...state, selectedBarcodeIds: selected };
}

export function toggleSelectAllBarcodes(state: ProductEditState): ProductEditState {
  const allSelected = state.barcodes.length > 0 && state.selectedBarcodeIds.length === state.barcodes.length;
  return { ...state, selectedBarcodeIds: allSelected ? [] : state.barcodes.map((b) => b.id) };
}

export function startEditBarcodeDesc(state: ProductEditState, id: string): ProductEditState {
  return { ...state, editingBarcodeId: id };
}

export function changeBarcodeDesc(state: ProductEditState, id: string, value: string): ProductEditState {
  return { ...state, barcodes: state.barcodes.map((b) => (b.id === id ? { ...b, description: value } : b)) };
}

export function commitBarcodeDescEdit(state: ProductEditState): ProductEditState {
  return { ...state, editingBarcodeId: null, saveArmed: false };
}

export function toggleAddBarcode(state: ProductEditState): ProductEditState {
  return { ...state, addBarcodeOpen: !state.addBarcodeOpen, newBarcodeDesc: "", newBarcodeCode: "" };
}

export function setNewBarcodeDesc(state: ProductEditState, value: string): ProductEditState {
  return { ...state, newBarcodeDesc: value };
}

export function setNewBarcodeCode(state: ProductEditState, value: string): ProductEditState {
  return { ...state, newBarcodeCode: value };
}

export function newBarcodeValid(state: ProductEditState): boolean {
  return state.newBarcodeDesc.trim().length > 0 && state.newBarcodeCode.replace(/\D/g, "").length >= 8;
}

/** Links the pending barcode directly if it's free, or opens the move-and-confirm flow if another product already has it. */
export function addBarcode(state: ProductEditState, allProducts: Product[]): ProductEditState {
  if (!newBarcodeValid(state)) return state;
  const code = state.newBarcodeCode.replace(/\s/g, "").trim();
  const description = state.newBarcodeDesc.trim();
  const owner = allProducts.find((p) => p.id !== state.productId && p.barcodes.some((b) => b.code === code));
  if (owner) {
    return { ...state, confirm: { type: "barcode", code, description, ownerId: owner.id, ownerName: owner.short_description } };
  }
  return addBarcodeDirect(state, code, description);
}

function addBarcodeDirect(state: ProductEditState, code: string, description: string): ProductEditState {
  const barcode: Barcode = { id: `${state.productId}-bc${Date.now()}`, code, description, product_id: state.productId };
  return { ...state, barcodes: [...state.barcodes, barcode], addBarcodeOpen: false, newBarcodeDesc: "", newBarcodeCode: "", saveArmed: false };
}

export function confirmBarcodeMove(state: ProductEditState): ProductEditState {
  if (!state.confirm || state.confirm.type !== "barcode") return state;
  const { code, description, ownerId } = state.confirm;
  const next = addBarcodeDirect({ ...state, confirm: null }, code, description);
  return { ...next, unlinkBarcodesFrom: [...next.unlinkBarcodesFrom, { productId: ownerId, code }] };
}

/** No confirmation needed — like alias removal, this is just staged and fully reversible via Cancel; Save's own confirm-to-commit step is the one confirmation this edit session needs. */
export function removeSelectedBarcodes(state: ProductEditState): ProductEditState {
  if (state.selectedBarcodeIds.length === 0) return state;
  return {
    ...state,
    barcodes: state.barcodes.filter((b) => !state.selectedBarcodeIds.includes(b.id)),
    selectedBarcodeIds: [],
    saveArmed: false,
  };
}

export function cancelConfirm(state: ProductEditState): ProductEditState {
  return { ...state, confirm: null };
}

// --- Save ---------------------------------------------------------------

export function canSave(state: ProductEditState): boolean {
  return state.short.trim().length > 0 && hasChanges(state);
}

/**
 * The confirm-to-commit pattern's "arm" step: validates short_description
 * uniqueness (re-checked here, not just when first typed — Product Edit.md's
 * Non-functional section), then flips Save into its "Confirm?" state. A
 * conflict sets shortError instead of arming, same as any other blocked save.
 */
export function armSave(state: ProductEditState, allProducts: Product[], t: TFunctions["t"]): ProductEditState {
  const trimmed = state.short.trim();
  if (!trimmed) return state;
  const conflict = allProducts.find(
    (p) => p.id !== state.productId && p.short_description.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (conflict) {
    return { ...state, shortError: t("productEdit.shortDescriptionConflict", { name: trimmed }) };
  }
  if (!hasChanges(state)) return state;
  return { ...state, saveArmed: true, shortError: null };
}

export function disarmSave(state: ProductEditState): ProductEditState {
  return { ...state, saveArmed: false };
}

// Full independent clauses joined with "; ", not Intl.ListFormat (built for
// parallel nouns/units, not semicolon-separated sentences — see
// stockEdit.ts's saveSummary() for where formatList() IS the right tool).
// tPlural is threaded into the freshness-days fragment even though English
// never actually shows "1 day" here (a blank fresh value always renders
// "none" instead) — Portuguese grammatical agreement still needs the split.
export function saveSummary(state: ProductEditState, i18n: Pick<TFunctions, "t" | "tPlural">): string {
  const { t, tPlural } = i18n;
  const orig: Snapshot = JSON.parse(state.orig);
  const bits: string[] = [];
  if (orig.short !== state.short.trim()) bits.push(t("productEdit.saveSummary.renamedTo", { name: state.short.trim() }));
  if (orig.long !== state.long) bits.push(t("productEdit.saveSummary.longDescriptionUpdated"));
  if (orig.doesExpire !== state.doesExpire) {
    bits.push(state.doesExpire ? t("productEdit.saveSummary.expiryOn") : t("productEdit.saveSummary.expiryOff"));
  }
  if (orig.minQty !== state.minQty) {
    const value = state.minQty === "" ? t("productEdit.saveSummary.none") : state.minQty;
    bits.push(t("productEdit.saveSummary.minQtyChanged", { value }));
  }
  if (orig.fresh !== state.fresh) {
    const value =
      state.fresh === ""
        ? t("productEdit.saveSummary.none")
        : tPlural("productEdit.saveSummary.freshDaysValue", Number.parseInt(state.fresh, 10) || 0);
    bits.push(t("productEdit.saveSummary.freshChanged", { value }));
  }
  if (JSON.stringify(orig.aliases) !== JSON.stringify(state.aliases)) bits.push(t("productEdit.saveSummary.aliasesUpdated"));
  if (JSON.stringify(orig.barcodes) !== JSON.stringify(snapshot(state).barcodes)) {
    bits.push(tPlural("productEdit.saveSummary.barcodesUpdated", state.barcodes.length));
  }
  return bits.length
    ? t("productEdit.saveSummary.prefix", { list: bits.join("; ") })
    : t("productEdit.saveSummary.noChanges");
}

export interface ProductEditResult {
  updatedProduct: Product;
  /** Other products this save must also touch, atomically — barcodes/aliases that moved away from them. */
  otherProductUpdates: { productId: string; removeBarcodeCodes: string[]; removeAliases: string[] }[];
}

/** Resolves the staged edits (and any moves) into the concrete writes Save must apply — see ProductList.tsx's save handler. */
export function buildSaveResult(state: ProductEditState, currentProduct: Product): ProductEditResult {
  const updatedProduct: Product = {
    ...currentProduct,
    short_description: state.short.trim(),
    long_description: state.long,
    does_expire: state.doesExpire,
    minimal_quantity: state.minQty === "" ? null : Number.parseInt(state.minQty, 10) || 0,
    freshness_threshold_days: state.fresh === "" ? null : Number.parseInt(state.fresh, 10) || 0,
    aliases: state.aliases,
    barcodes: state.barcodes.map((b) => ({ ...b, product_id: currentProduct.id })),
  };

  const byProduct = new Map<string, { removeBarcodeCodes: string[]; removeAliases: string[] }>();
  const bucket = (id: string) => {
    let b = byProduct.get(id);
    if (!b) {
      b = { removeBarcodeCodes: [], removeAliases: [] };
      byProduct.set(id, b);
    }
    return b;
  };
  for (const u of state.unlinkBarcodesFrom) bucket(u.productId).removeBarcodeCodes.push(u.code);
  for (const u of state.unlinkAliasFrom) bucket(u.productId).removeAliases.push(u.alias);

  return {
    updatedProduct,
    otherProductUpdates: Array.from(byProduct.entries()).map(([productId, v]) => ({ productId, ...v })),
  };
}

/** Reshapes a ProductEditResult into apps/api's PATCH /products/:id request body. */
export function buildEditProductPayload(result: ProductEditResult): UpdateProductPayload {
  return {
    short_description: result.updatedProduct.short_description,
    long_description: result.updatedProduct.long_description,
    does_expire: result.updatedProduct.does_expire,
    minimal_quantity: result.updatedProduct.minimal_quantity,
    freshness_threshold_days: result.updatedProduct.freshness_threshold_days,
    aliases: result.updatedProduct.aliases,
    barcodes: result.updatedProduct.barcodes.map((b) => ({ code: b.code, description: b.description })),
    other_product_updates: result.otherProductUpdates.map((u) => ({
      product_id: u.productId,
      remove_barcode_codes: u.removeBarcodeCodes,
      remove_aliases: u.removeAliases,
    })),
  };
}
