import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Footer, FreshnessBadge, Input, cn } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { ScopeTile } from "../components/ScopeTile";
import { SectionHeader } from "../components/SectionHeader";
import { freshnessBadgeLabel } from "../lib/freshness";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import { ApiError, lookupBarcode, updateProduct } from "../lib/api";
import { isBarcodeScanSupported } from "../lib/barcodeScanner";
import type { AddProductLocationState } from "./AddProduct";
import { enrichProduct, matchesSearch, type EnrichedProduct, type InventoryDefaults } from "../lib/inventory";
import {
  groupByGroceryCategory,
  matchesGroceryScope,
  type GroceryGroup,
  type GroceryScope,
} from "../lib/groceryList";
import {
  applyQuickEdit,
  bumpQuickEdit,
  commitQuickEditDraft,
  openQuickEditState,
  resetQuickEdit,
  type QuickEditState,
} from "../lib/quickBatchEdit";
import {
  addAlias,
  addBarcode,
  armSave,
  buildEditProductPayload,
  buildSaveResult,
  cancelConfirm,
  changeBarcodeDesc,
  commitBarcodeDescEdit,
  confirmAliasMove,
  confirmBarcodeMove,
  openProductEditState,
  removeAlias,
  removeSelectedBarcodes,
  setDoesExpire,
  setField,
  setNewAlias,
  setNewBarcodeCode,
  setNewBarcodeDesc,
  startEditBarcodeDesc,
  toggleAddBarcode,
  toggleBarcodeSelected,
  toggleSelectAllBarcodes,
  type ProductEditState,
} from "../lib/productEdit";
import { BarcodeCaptureModal } from "../components/BarcodeCaptureModal";
import { QuickBatchEditModal } from "../components/QuickBatchEditModal";
import { ProductEditView } from "../components/ProductEditView";

const SAVED_MESSAGE_DELAY_MS = 2600;
// Same long-press threshold Inventory.tsx's/Product List's own hold-to-open gesture uses.
const HOLD_MS = 480;

/**
 * specs/Grocery List.md — a focused view of what's currently low or
 * completely out of stock, so shopping doesn't require scanning the whole
 * Inventory for trouble spots. The other half of Inventory.md's own "Open
 * gap" note (Product List.md covers the full-catalog half; this covers
 * "what's missing").
 *
 * Reuses Inventory's own building blocks wherever they already fit —
 * enrichProduct/matchesSearch (lib/inventory.ts), the barcode-scan-first
 * lookup pipeline, Quick Batch Edit, and Product Edit — rather than
 * re-deriving any of them. Cards instead of rows/table (per the spec's own
 * explicit ask), with the same tap-to-expand / hold-to-quick-edit gestures
 * as an Inventory row, just retargeted at a card and without the
 * swipe-to-reveal panel (not needed — Product List's "⋯" popover pattern
 * isn't used here either; there's nothing else to do with a card besides
 * expand or quick-edit it).
 */
export function GroceryListPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<GroceryScope>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Collapsible search/filters section — same SectionHeader pattern
  // Product List.md's own page uses, open by default since narrowing this
  // already-short list is this page's primary interaction.
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { products, batches, setProducts, setBatches, loading, error, refetch } = useProductsStore();
  const { preferences } = usePreferencesStore();
  const i18n = useT();
  const { t } = i18n;
  const navigate = useNavigate();

  // --- Add Product flow: barcode-scan-first entry (specs/Barcode Scanner &
  // Product info scrape.md), identical wiring to Inventory.tsx's own — this
  // page adds no barcode-matching logic of its own, just a second entry
  // point into the same flow.
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // --- Product Edit (identical wiring to Inventory.tsx/ProductList.tsx) ---
  const [edit, setEdit] = useState<ProductEditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(null);

  // --- Quick Batch Edit: hold-to-open card gesture, same gesture/timing as
  // Inventory.tsx's row long-press, minus its swipe-to-reveal panel.
  const [quick, setQuick] = useState<QuickEditState | null>(null);
  const pressRef = useRef<{ id: string; x: number; y: number; moved: boolean; fired: boolean } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  // A hold suppresses the *next* card click so opening the modal never also
  // toggles the card's expand state — same convention Inventory.tsx's own
  // suppressClickRef documents.
  const suppressClickRef = useRef(false);

  const savedMessageTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const today = useMemo(() => new Date(), []);

  const listDefaults: InventoryDefaults = useMemo(
    () => ({
      freshnessThresholdDays: preferences.default_freshness_threshold_days,
      minimalQuantity: preferences.default_minimal_quantity,
      minimalPercentage: preferences.default_minimal_percentage,
    }),
    [preferences.default_freshness_threshold_days, preferences.default_minimal_quantity, preferences.default_minimal_percentage],
  );

  // Unlike Inventory.tsx's own `all`, this deliberately does NOT filter out
  // zero-quantity products (isVisibleInInventory) — an Occasional product
  // at zero stock is exactly what the Occasional tile exists to surface.
  const enriched = useMemo(
    () =>
      products.map((p) =>
        enrichProduct(
          p,
          batches.filter((b) => b.product_id === p.id),
          today,
          listDefaults,
          i18n,
        ),
      ),
    [products, batches, today, listDefaults, i18n],
  );

  // The full candidate set (Low stock ∪ Occasional-and-out) — tile counts
  // are computed from this, independent of the active scope/search, same
  // convention Inventory.tsx's own Attention/Low-stock tile counts use.
  const candidates = useMemo(
    () => enriched.filter((p) => matchesGroceryScope(p, "all", listDefaults)),
    [enriched, listDefaults],
  );
  const countAll = candidates.length;
  const countLow = useMemo(() => candidates.filter((p) => matchesGroceryScope(p, "low", listDefaults)).length, [candidates, listDefaults]);
  const countOccasional = countAll - countLow;

  const filtered = useMemo(
    () => candidates.filter((p) => matchesGroceryScope(p, scope, listDefaults) && matchesSearch(p, query)),
    [candidates, scope, query, listDefaults],
  );

  // Sticky-header groups, same "grouped rows" visual as Inventory's own
  // groupByStatus, just grouped by this screen's organizing idea (stock
  // level) instead of freshness. When a specific scope tile is active
  // (not All), the other group's predicate naturally matches nothing and
  // only one header renders — no special-casing needed.
  const groups: GroceryGroup[] = useMemo(
    () => groupByGroceryCategory(filtered, listDefaults, i18n.locale, t),
    [filtered, listDefaults, i18n.locale, t],
  );

  const hasFilters = query.length > 0 || scope !== "all";

  const quickProduct = useMemo(
    () => (quick ? (enriched.find((p) => p.id === quick.productId) ?? null) : null),
    [enriched, quick],
  );

  const editDatedBatchCount = useMemo(
    () => (edit ? batches.filter((b) => b.product_id === edit.productId && b.expires_on !== null).length : 0),
    [batches, edit],
  );

  function clearFilters() {
    setQuery("");
    setScope("all");
  }

  function toggleExpanded(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }

  // --- Quick Batch Edit: gestures (tap-to-expand / hold-to-open, no swipe) ---

  function openQuick(id: string, total: number, mode: "units" | "percentage") {
    setQuick(openQuickEditState(id, total, mode));
  }

  function handlePressStart(id: string, total: number, mode: "units" | "percentage", e: ReactPointerEvent) {
    if (e.button && e.button !== 0) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = { id, x: e.clientX, y: e.clientY, moved: false, fired: false };
    holdTimerRef.current = window.setTimeout(() => {
      const press = pressRef.current;
      if (!press || press.moved) return;
      press.fired = true;
      openQuick(id, total, mode);
    }, HOLD_MS);
  }
  function handlePressMove(e: ReactPointerEvent) {
    const press = pressRef.current;
    if (!press || press.fired) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      press.moved = true;
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    }
  }
  function handlePressEnd() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    const press = pressRef.current;
    pressRef.current = null;
    if (press && press.fired) {
      suppressClickRef.current = true;
    }
  }
  function handlePressAbort() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = null;
  }

  function quickClose() {
    setQuick(null);
  }
  function quickBump(delta: number) {
    setQuick((q) => (q ? bumpQuickEdit(q, delta) : q));
  }
  function quickStartEdit() {
    setQuick((q) => (q ? { ...q, editing: true, draft: String(q.target) } : q));
  }
  function quickDraftChange(value: string) {
    setQuick((q) => (q ? { ...q, draft: value } : q));
  }
  function quickDraftCommit() {
    setQuick((q) => (q ? commitQuickEditDraft(q) : q));
  }
  function quickAddExpiresOnChange(value: string) {
    setQuick((q) => (q ? { ...q, addExpiresOn: value } : q));
  }
  function quickReset() {
    setQuick((q) => (q ? resetQuickEdit(q) : q));
  }
  function quickSave() {
    if (!quick) return;
    const product = products.find((p) => p.id === quick.productId);
    if (product) {
      if (product.tracking_mode === "percentage") {
        // specs/Relative Tracking.md: overwrites stock_percent directly —
        // no Batch is ever created or cascaded through for this mode.
        setProducts((ps) => ps.map((p) => (p.id === product.id ? { ...p, stock_percent: quick.target } : p)));
      } else {
        const delta = quick.target - quick.base;
        const productBatches = batches.filter((b) => b.product_id === quick.productId);
        const updated = applyQuickEdit(productBatches, quick.productId, product.does_expire, delta, quick.addExpiresOn);
        setBatches((bs) => [...bs.filter((b) => b.product_id !== quick.productId), ...updated]);
      }
    }
    setQuick(null);
  }

  // --- Stock Edit — a real route (Stock Edit.md), same as Inventory.tsx's own.
  function openStock(id: string) {
    setQuick(null);
    navigate(`/products/${id}/stock`);
  }

  // --- Product Edit (verbatim from Inventory.tsx/ProductList.tsx) --------

  function openProductEdit(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setQuick(null);
    setEditSaveError(null);
    setEdit(openProductEditState(product));
  }
  function editClose() {
    setEdit(null);
    setEditSaveError(null);
  }
  function editFieldChange(key: "short" | "long" | "minQty" | "fresh" | "minPercent", value: string) {
    if (edit) setEdit(setField(edit, key, value));
  }
  function editDoesExpireChange(value: boolean) {
    if (edit) setEdit(setDoesExpire(edit, value));
  }
  function editNewAliasChange(value: string) {
    if (edit) setEdit(setNewAlias(edit, value));
  }
  function editAddAlias() {
    if (edit) setEdit(addAlias(edit, products, t));
  }
  function editRemoveAlias(alias: string) {
    if (edit) setEdit(removeAlias(edit, alias));
  }
  function editToggleBarcodeSelected(id: string) {
    if (edit) setEdit(toggleBarcodeSelected(edit, id));
  }
  function editToggleSelectAllBarcodes() {
    if (edit) setEdit(toggleSelectAllBarcodes(edit));
  }
  function editStartEditBarcodeDesc(id: string) {
    if (edit) setEdit(startEditBarcodeDesc(edit, id));
  }
  function editBarcodeDescChange(id: string, value: string) {
    if (edit) setEdit(changeBarcodeDesc(edit, id, value));
  }
  function editCommitBarcodeDescEdit() {
    if (edit) setEdit(commitBarcodeDescEdit(edit));
  }
  function editToggleAddBarcode() {
    if (edit) setEdit(toggleAddBarcode(edit));
  }
  function editNewBarcodeDescChange(value: string) {
    if (edit) setEdit(setNewBarcodeDesc(edit, value));
  }
  function editNewBarcodeCodeChange(value: string) {
    if (edit) setEdit(setNewBarcodeCode(edit, value));
  }
  function editAddBarcode() {
    if (edit) setEdit(addBarcode(edit, products));
  }
  function editRemoveSelectedBarcodes() {
    if (edit) setEdit(removeSelectedBarcodes(edit));
  }
  function editConfirmMove() {
    if (!edit || !edit.confirm) return;
    if (edit.confirm.type === "alias") setEdit(confirmAliasMove(edit));
    else if (edit.confirm.type === "barcode") setEdit(confirmBarcodeMove(edit));
  }
  function editCancelConfirm() {
    if (edit) setEdit(cancelConfirm(edit));
  }
  async function editSave() {
    if (!edit) return;
    if (!edit.saveArmed) {
      setEditSaveError(null);
      setEdit(armSave(edit, products, t));
      return;
    }
    const product = products.find((p) => p.id === edit.productId);
    if (!product) {
      setEdit(null);
      return;
    }
    const saveResult = buildSaveResult(edit, product);
    setEditSaving(true);
    setEditSaveError(null);
    try {
      const { product: updatedProduct, batches: updatedBatches } = await updateProduct(
        edit.productId,
        buildEditProductPayload(saveResult),
      );
      setProducts((ps) =>
        ps.map((p) => {
          if (p.id === updatedProduct.id) return updatedProduct;
          const upd = saveResult.otherProductUpdates.find((u) => u.productId === p.id);
          if (!upd) return p;
          return {
            ...p,
            barcodes: p.barcodes.filter((b) => !upd.removeBarcodeCodes.includes(b.code)),
            aliases: p.aliases.filter((a) => !upd.removeAliases.includes(a)),
          };
        }),
      );
      setBatches((bs) => [...bs.filter((b) => b.product_id !== updatedProduct.id), ...updatedBatches]);
      setJustSavedMessage(t("inventory.savedProductUpdated", { name: updatedProduct.short_description }));
      if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
      savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
      setEdit(null);
    } catch (err) {
      setEditSaveError(err instanceof ApiError ? err.message : t("inventory.genericSaveError"));
    } finally {
      setEditSaving(false);
    }
  }

  // --- Barcode scan entry (verbatim wiring from Inventory.tsx, minus the
  // "+ Add" button — this page has no arbitrary-add flow, only the camera
  // button beside search) ---------------------------------------------------

  function openScan() {
    if (isBarcodeScanSupported()) {
      setScanOpen(true);
    } else {
      navigate("/products/add", { state: { from: "/grocery" } satisfies AddProductLocationState });
    }
  }

  async function handleDetect(code: string) {
    setScanOpen(false);
    const match = products.find((p) => p.barcodes.some((b) => b.code === code));
    if (match) {
      const total =
        match.tracking_mode === "percentage"
          ? (match.stock_percent ?? 0)
          : batches.filter((b) => b.product_id === match.id).reduce((sum, b) => sum + b.quantity, 0);
      openQuick(match.id, total, match.tracking_mode);
      return;
    }
    setLookupLoading(true);
    try {
      const lookup = await lookupBarcode(code);
      navigate("/products/add", { state: { barcode: code, lookup, from: "/grocery" } satisfies AddProductLocationState });
    } finally {
      setLookupLoading(false);
    }
  }

  function handleCancelScan() {
    setScanOpen(false);
    navigate("/products/add", { state: { from: "/grocery" } satisfies AddProductLocationState });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Same top-[60px] offset as Inventory.tsx/ProductList.tsx — sticks just below AppShell's own sticky app bar. */}
      <header className="sticky top-[60px] z-[3] flex flex-col gap-[14px] border-b border-border bg-surface-0 px-md pb-[12px] pt-[22px]">
        <SectionHeader
          label={t("groceryList.searchFiltersHeading")}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
        />

        {filtersOpen && (
          <>
            <div className="flex items-center gap-sm">
              <div className="relative flex-1">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <Input
                  className="h-11"
                  style={{ paddingLeft: 34, paddingRight: query ? 34 : undefined }}
                  placeholder={t("groceryList.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={t("groceryList.clearSearchLabel")}
                    title={t("groceryList.clearSearchLabel")}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[13px] text-ink-muted hover:bg-surface-2"
                  >
                    ✕
                  </button>
                )}
              </div>
              {/* Camera button: opens the same barcode-scan-first pipeline
                  as Inventory/Product List's own "+ Add" (specs/Barcode
                  Scanner & Product info scrape.md) — a local match opens
                  Quick Batch Edit directly, a miss falls through to the
                  Open Food Facts/Tavily lookup + manual-add form. No new
                  barcode logic lives on this page. */}
              <button
                type="button"
                onClick={openScan}
                aria-label={t("groceryList.scanBarcodeLabel")}
                title={t("groceryList.scanBarcodeLabel")}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-[18px]"
              >
                📷
              </button>
            </div>

            <div className="grid grid-cols-3 gap-sm">
              <ScopeTile
                active={scope === "all"}
                count={countAll}
                label={t("groceryList.scopeAll")}
                activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                onClick={() => setScope("all")}
              />
              <ScopeTile
                active={scope === "low"}
                count={countLow}
                label={t("groceryList.scopeLowStock")}
                activeClassName="border-info bg-info-bg text-info"
                hoverClassName="hover:border-info"
                onClick={() => setScope((s) => (s === "low" ? "all" : "low"))}
              />
              <ScopeTile
                active={scope === "occasional"}
                count={countOccasional}
                label={t("groceryList.scopeOccasional")}
                activeClassName="border-warning bg-warning-bg text-warning"
                hoverClassName="hover:border-warning"
                onClick={() => setScope((s) => (s === "occasional" ? "all" : "occasional"))}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-[12px] pb-[2px]">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            {i18n.tPlural("groceryList.resultCount", filtered.length)}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-[12px] font-semibold text-brand-600 underline">
              {t("groceryList.clearFilters")}
            </button>
          )}
        </div>
      </header>

      {justSavedMessage && (
        <div className="px-md pt-sm">
          <Alert variant="success" title={justSavedMessage} />
        </div>
      )}
      {lookupLoading && (
        <div className="px-md pt-sm">
          <Alert variant="info" title={t("addProduct.lookingUpProduct")} />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-[64px] text-[13px] text-ink-muted">
            {t("groceryList.loading")}
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <Alert variant="danger" title={t("groceryList.loadError")}>
              {error}
            </Alert>
            <Button variant="outline" onClick={refetch}>
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : filtered.length > 0 ? (
          groups.map((g) => (
            <div key={g.key} className="flex flex-col">
              <div className="sticky top-0 z-[1] flex items-center gap-[10px] bg-surface-1 px-md pb-[8px] pt-[14px]">
                <span className={cn("h-[7px] w-[7px] flex-shrink-0 rounded-full", groupDotClass(g.key))} />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary">{g.label}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[11px] text-ink-muted">{g.count}</span>
              </div>
              {g.products.map((p) => (
                <GroceryRow
                  key={p.id}
                  product={p}
                  outOfStock={g.key === "occasional"}
                  expanded={!!expanded[p.id]}
                  onToggle={() => toggleExpanded(p.id)}
                  onPressStart={(e) => handlePressStart(p.id, p.totalQty, p.tracking_mode, e)}
                  onPressMove={handlePressMove}
                  onPressEnd={handlePressEnd}
                  onPressAbort={handlePressAbort}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-border-strong font-mono text-[13px] text-ink-muted">
              0
            </div>
            <div className="text-[16px] font-semibold">
              {hasFilters ? t("groceryList.emptyFilteredTitle") : t("groceryList.emptyNothingTitle")}
            </div>
            <div className="max-w-[260px] text-[13px] text-ink-secondary">
              {hasFilters ? t("groceryList.emptyFilteredHint") : t("groceryList.emptyNothingHint")}
            </div>
            {hasFilters && <Button onClick={clearFilters}>{t("groceryList.clearFilters")}</Button>}
          </div>
        )}
      </div>

      <Footer />

      <BarcodeCaptureModal open={scanOpen} onDetect={handleDetect} onCancel={handleCancelScan} />

      <QuickBatchEditModal
        quick={quick}
        product={quickProduct}
        onClose={quickClose}
        onBump={quickBump}
        onStartEdit={quickStartEdit}
        onDraftChange={quickDraftChange}
        onDraftCommit={quickDraftCommit}
        onAddExpiresOnChange={quickAddExpiresOnChange}
        onReset={quickReset}
        onSave={quickSave}
        onStock={() => quick && openStock(quick.productId)}
        onEditProduct={() => quick && openProductEdit(quick.productId)}
      />

      <ProductEditView
        edit={edit}
        datedBatchCount={editDatedBatchCount}
        onClose={editClose}
        onFieldChange={editFieldChange}
        onDoesExpireChange={editDoesExpireChange}
        onNewAliasChange={editNewAliasChange}
        onAddAlias={editAddAlias}
        onRemoveAlias={editRemoveAlias}
        onToggleBarcodeSelected={editToggleBarcodeSelected}
        onToggleSelectAllBarcodes={editToggleSelectAllBarcodes}
        onStartEditBarcodeDesc={editStartEditBarcodeDesc}
        onBarcodeDescChange={editBarcodeDescChange}
        onCommitBarcodeDescEdit={editCommitBarcodeDescEdit}
        onToggleAddBarcode={editToggleAddBarcode}
        onNewBarcodeDescChange={editNewBarcodeDescChange}
        onNewBarcodeCodeChange={editNewBarcodeCodeChange}
        onAddBarcode={editAddBarcode}
        onRemoveSelectedBarcodes={editRemoveSelectedBarcodes}
        onConfirmMove={editConfirmMove}
        onCancelConfirm={editCancelConfirm}
        onSave={editSave}
        saving={editSaving}
        saveError={editSaveError}
      />
    </div>
  );
}

/** Sticky group header dot color — info for Low stock, warning for Occasional, matching this screen's own scope-tile colors (and Inventory's groupByStatus dot-per-status convention). */
function groupDotClass(key: GroceryGroup["key"]): string {
  return key === "low" ? "bg-info" : "bg-warning";
}

/** Row's left accent bar — freshness-colored for a Low stock item (same as Inventory's own accentBarClass), a flat danger color for an out-of-stock Occasional item, which has no freshness status to color it by. */
function accentBarClass(p: EnrichedProduct, outOfStock: boolean): string {
  if (outOfStock) return "bg-danger";
  switch (p.status) {
    case "expired":
      return "bg-freshness-expired";
    case "expiring-soon":
      return "bg-freshness-expiring-soon";
    case "fresh":
      return "bg-freshness-fresh";
    default:
      return "bg-border-strong";
  }
}

/**
 * A row, not a boxed card — same flush, accent-barred visual as Inventory's
 * own ProductRow (apps/web/src/pages/Inventory.tsx), just without its
 * swipe-to-reveal panel (see this page's own doc comment for why). Tap
 * toggles expand, hold (~480ms, wired by the caller) opens Quick Batch Edit.
 */
function GroceryRow({
  product: p,
  outOfStock,
  expanded,
  onToggle,
  onPressStart,
  onPressMove,
  onPressEnd,
  onPressAbort,
}: {
  product: EnrichedProduct;
  /** specs/Grocery List.md: an Occasional product at zero stock — no batches, no FreshnessBadge, no expand; a distinct "Out of stock" tag instead of "LOW" (it was never below a threshold — it has no threshold). */
  outOfStock: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPressStart: (e: ReactPointerEvent) => void;
  onPressMove: (e: ReactPointerEvent) => void;
  onPressEnd: (e: ReactPointerEvent) => void;
  onPressAbort: () => void;
}) {
  const { t } = useT();
  const isPercentage = p.tracking_mode === "percentage";
  const canExpand = !outOfStock;
  // An out-of-stock Occasional item has no batches to summarize — see the
  // component doc comment; metaLabel is only ever read when !outOfStock.
  const metaLabel = isPercentage
    ? t("inventory.percentTrackedMeta")
    : (p.batches.length > 1 ? t("inventory.batchesCountPrefix", { count: p.batches.length }) : "") +
      (p.batches[0]?.expiryLabel ?? t("freshness.doesNotExpire"));

  return (
    <div className="-mb-px flex border-b border-t border-border">
      <div className={cn("w-[3px] flex-shrink-0", accentBarClass(p, outOfStock))} />
      <div
        onPointerDown={onPressStart}
        onPointerMove={onPressMove}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressAbort}
        onContextMenu={(e) => e.preventDefault()}
        className="relative min-w-0 flex-1 bg-surface-0"
        style={{ touchAction: "pan-y" }}
      >
        <button
          type="button"
          onClick={canExpand ? onToggle : undefined}
          className={cn("flex w-full items-center gap-md px-md py-[13px] text-left", !canExpand && "cursor-default")}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex items-center gap-sm">
              <span className="truncate text-[15px] font-semibold">{p.short_description}</span>
              {outOfStock ? (
                <span className="flex-shrink-0 rounded-full bg-danger-bg px-sm py-[2px] font-mono text-[10px] tracking-[0.06em] text-danger">
                  {t("groceryList.outOfStockBadge")}
                </span>
              ) : (
                <span className="flex-shrink-0 rounded-full bg-info-bg px-sm py-[2px] font-mono text-[10px] tracking-[0.06em] text-info">
                  {t("inventory.lowBadge")}
                </span>
              )}
            </div>
            {!outOfStock && <span className="truncate text-[12px] text-ink-muted">{metaLabel}</span>}
          </div>
          <span className="flex-shrink-0 font-mono text-[17px] font-semibold text-ink-primary">
            {p.totalQty}
            {isPercentage && "%"}
          </span>
          {!outOfStock && <FreshnessBadge status={p.status} label={freshnessBadgeLabel(p.status, t)} />}
          {canExpand && (
            <span
              className={cn(
                "flex-shrink-0 text-[11px] text-ink-muted transition-transform",
                expanded ? "rotate-180" : "rotate-0",
              )}
            >
              ▼
            </span>
          )}
        </button>
        {canExpand && expanded && (
          <div className="flex flex-col gap-sm px-md pb-[14px]">
            {isPercentage ? (
              <p className="text-xs text-ink-muted">{t("inventory.percentTrackedExpandNote")}</p>
            ) : (
              p.batches.map((b) => (
                <div key={b.id} className="flex items-center gap-[10px] rounded-md bg-surface-2 px-[11px] py-[9px]">
                  <span className="min-w-[34px] font-mono text-[12px] font-semibold text-ink-primary">{b.qtyLabel}</span>
                  <span className="flex-1 truncate text-[12px] text-ink-secondary">{b.expiryLabel}</span>
                  <FreshnessBadge status={b.status} label={freshnessBadgeLabel(b.status, t)} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
