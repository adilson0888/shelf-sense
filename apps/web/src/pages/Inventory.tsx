import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, FreshnessBadge, Input, cn } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { freshnessBadgeLabel } from "../lib/freshness";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import { ApiError, createProduct, updateProduct } from "../lib/api";
import {
  type EnrichedProduct,
  type ListScope,
  enrichProduct,
  groupAlphabetically,
  groupByStatus,
  isVisibleInInventory,
  matchesScope,
  matchesSearch,
} from "../lib/inventory";
import {
  buildBlankForm,
  buildCreateProductPayload,
  type AddFlowStep,
  type AddProductFormState,
  type PrefillSource,
  MOCK_BARCODE_MATCH,
} from "../lib/addProduct";
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
import { AddProductModals } from "../components/AddProductModals";
import { QuickBatchEditModal } from "../components/QuickBatchEditModal";
import { ProductEditView } from "../components/ProductEditView";

const SAVED_MESSAGE_DELAY_MS = 2600;

/**
 * Real implementation of the approved Claude Design prototype, merged
 * version (templates/product-list-alt/ProductListAlt.dc.html, "Product
 * List — Triage" + the Add Product flow wired into the same screen).
 * Translated to real React + shelf-sense-ds components and Tailwind idiom
 * rather than the design canvas's inline-style markup — see chat history
 * for what changed in translation (freshness threshold 7d not 5d,
 * per-product minimal_quantity not a flat 3, group labels no longer
 * promise a fixed day count).
 *
 * Renamed from "Product List" to "Inventory" (specs/Inventory.md) — this
 * screen is what's physically on the shelf, not a general product catalog,
 * so it now also excludes any product with 0 total quantity across all
 * batches (see isVisibleInInventory in lib/inventory.ts). A separately
 * specced Product List screen (full catalog) and Grocery List screen
 * (what's missing) are planned to cover what this screen no longer shows.
 *
 * Inventory list/save now wired to real apps/api endpoints (GET/POST
 * /products — see productsStore.tsx and lib/api.ts). The Add flow's scan/
 * photo/match steps stay simulated (MOCK_BARCODE_MATCH) — no real
 * barcode-lookup or vision-identify endpoint exists yet (Product Add.md);
 * see specs/Persistence.md for the scope split.
 */
export function InventoryPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ListScope>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "alpha">("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { products, batches, setProducts, setBatches, loading, error, refetch } = useProductsStore();
  const { preferences } = usePreferencesStore();
  const i18n = useT();
  const { t } = i18n;
  const navigate = useNavigate();
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(null);

  const [addStep, setAddStep] = useState<AddFlowStep>("idle");
  const [addSource, setAddSource] = useState<PrefillSource>(null);
  const [addForm, setAddForm] = useState<AddProductFormState>(() => buildBlankForm(preferences.default_does_expire));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Product Edit ------------------------------------------------------
  const [edit, setEdit] = useState<ProductEditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  // --- Quick Batch Edit: hold-to-open / swipe-to-reveal row gestures -----
  const [quick, setQuick] = useState<QuickEditState | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  // Mutable, non-render-triggering bookkeeping for the in-flight gesture —
  // must be read synchronously inside pointer handlers, not via state.
  const pressRef = useRef<{ id: string; x: number; y: number; moved: boolean; fired: boolean } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  // A hold or swipe suppresses the *next* row click so opening the modal
  // (or revealing the swipe panel) never also toggles the row's expand.
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

  const listDefaults = useMemo(
    () => ({
      freshnessThresholdDays: preferences.default_freshness_threshold_days,
      minimalQuantity: preferences.default_minimal_quantity,
    }),
    [preferences.default_freshness_threshold_days, preferences.default_minimal_quantity],
  );

  const all = useMemo(
    () =>
      products
        .map((p) =>
          enrichProduct(
            p,
            batches.filter((b) => b.product_id === p.id),
            today,
            listDefaults,
            i18n,
          ),
        )
        .filter(isVisibleInInventory),
    // i18n's own identity changes exactly when locale/dict change (see useT()'s memo), so this is exhaustive.
    [products, batches, today, listDefaults, i18n],
  );

  const filtered = useMemo(
    () => all.filter((p) => matchesSearch(p, query) && matchesScope(p, scope)),
    [all, query, scope],
  );

  const groups = useMemo(
    () => (sortBy === "alpha" ? groupAlphabetically(filtered, t) : groupByStatus(filtered, t)),
    [filtered, sortBy, t],
  );

  const countAttention = all.filter((p) => p.status === "expired" || p.status === "expiring-soon").length;
  const countLow = all.filter((p) => p.isLow).length;
  const hasFilters = query.length > 0 || scope !== "all";

  const quickProduct = useMemo(
    () => (quick ? (all.find((p) => p.id === quick.productId) ?? null) : null),
    [all, quick],
  );

  const editDatedBatchCount = useMemo(
    () => (edit ? batches.filter((b) => b.product_id === edit.productId && b.expires_on !== null).length : 0),
    [batches, edit],
  );

  function toggleExpanded(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }

  // --- Quick Batch Edit: gestures ---------------------------------------

  function openQuick(id: string, total: number) {
    setQuick(openQuickEditState(id, total));
  }
  function openQuickFromSwipe(id: string, total: number) {
    setSwipedId(null);
    openQuick(id, total);
  }

  // Long-press: pointer down starts a threshold timer; any real movement
  // (scroll or swipe) cancels it before it fires.
  function handlePressStart(id: string, total: number, e: ReactPointerEvent) {
    if (e.button && e.button !== 0) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = { id, x: e.clientX, y: e.clientY, moved: false, fired: false };
    holdTimerRef.current = window.setTimeout(() => {
      const press = pressRef.current;
      if (!press || press.moved) return;
      press.fired = true;
      setSwipedId(null);
      setDrag(null);
      openQuick(id, total);
    }, 480);
  }

  // Distinguishes a horizontal swipe (drags the row to reveal the "•••"
  // panel) from vertical scroll, and cancels the hold once real movement
  // is detected.
  function handlePressMove(e: ReactPointerEvent) {
    const press = pressRef.current;
    if (!press || press.fired) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      press.moved = true;
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    }
    if (!press.moved || Math.abs(dy) > Math.abs(dx)) return;
    const base = swipedId === press.id ? -76 : 0;
    const next = Math.min(0, Math.max(-88, base + dx));
    setDrag({ id: press.id, dx: next });
  }

  function handlePressEnd(id: string, _e: ReactPointerEvent) {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    const press = pressRef.current;
    pressRef.current = null;
    if (press && press.fired) {
      // The hold already opened the modal — just clear the drag, nothing else.
      suppressClickRef.current = true;
      setDrag(null);
      return;
    }
    if (drag && drag.id === id) {
      // Latch open past the 40px threshold, otherwise snap back closed.
      suppressClickRef.current = true;
      setSwipedId(drag.dx <= -40 ? id : null);
      setDrag(null);
      return;
    }
    if (swipedId === id) {
      // Tapping an already-open row closes its swipe panel instead of expanding.
      suppressClickRef.current = true;
      setSwipedId(null);
    }
  }

  function handlePressAbort() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = null;
    setDrag(null);
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
      const delta = quick.target - quick.base;
      const productBatches = batches.filter((b) => b.product_id === quick.productId);
      const updated = applyQuickEdit(productBatches, quick.productId, product.does_expire, delta, quick.addExpiresOn);
      setBatches((bs) => [...bs.filter((b) => b.product_id !== quick.productId), ...updated]);
    }
    setQuick(null);
  }

  // --- Stock Edit (Stock Edit.md) — a real route, not local modal state,
  // so it can stay mounted/reachable after InventoryPage unmounts.
  function openStock(id: string) {
    setQuick(null);
    navigate(`/products/${id}/stock`);
  }

  // --- Product Edit -----------------------------------------------------

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
  function editFieldChange(key: "short" | "long" | "minQty" | "fresh", value: string) {
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

  // --- Add Product flow -----------------------------------------------

  function openAddMethod() {
    setAddStep("method");
    setAddSource(null);
    setAddForm(buildBlankForm(preferences.default_does_expire));
    setJustSavedMessage(null);
    setSaveError(null);
  }
  function closeAddFlow() {
    setAddStep("idle");
    setAddSource(null);
    setSaveError(null);
  }
  function openManual() {
    setAddSource(null);
    setAddForm(buildBlankForm(preferences.default_does_expire));
    setAddStep("form");
  }
  function completeCapture() {
    if (addStep === "photo") {
      setAddSource("photo");
      setAddForm({ ...buildBlankForm(preferences.default_does_expire), short: "Grated cheese", long: MOCK_BARCODE_MATCH.long, qty: "1" });
      setAddStep("form");
    } else {
      setAddStep("match");
    }
  }
  function useMatchedProduct() {
    setAddSource("match-use");
    setAddForm({
      ...buildBlankForm(preferences.default_does_expire),
      short: MOCK_BARCODE_MATCH.short,
      long: MOCK_BARCODE_MATCH.long,
      qty: "1",
      minQty: MOCK_BARCODE_MATCH.minQty,
      fresh: MOCK_BARCODE_MATCH.fresh,
      doesExpire: true,
    });
    setAddStep("form");
  }
  function confirmUnlink() {
    setAddSource("match");
    setAddForm({
      short: "", // must diverge — short_description stays unique (Product Add.md)
      long: MOCK_BARCODE_MATCH.long,
      doesExpire: MOCK_BARCODE_MATCH.doesExpire,
      qty: MOCK_BARCODE_MATCH.qty,
      minQty: MOCK_BARCODE_MATCH.minQty,
      fresh: MOCK_BARCODE_MATCH.fresh,
      expiresOn: "",
    });
    setAddStep("form");
  }
  function clearPrefill() {
    setAddSource(null);
    setAddForm(buildBlankForm(preferences.default_does_expire));
  }
  function setFormField<K extends keyof AddProductFormState>(key: K, value: AddProductFormState[K]) {
    setAddForm((f) => ({ ...f, [key]: value }));
  }

  async function saveProduct() {
    setSaving(true);
    setSaveError(null);
    try {
      const { product, batch } = await createProduct(buildCreateProductPayload(addForm, listDefaults));
      setProducts((ps) => [product, ...ps]);
      if (batch) setBatches((bs) => [batch, ...bs]);
      setJustSavedMessage(t("inventory.productAdded"));
      setAddStep("idle");
      setAddSource(null);
      setAddForm(buildBlankForm(preferences.default_does_expire));
      setQuery("");
      setScope("all");

      if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
      savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("inventory.genericSaveError"));
    } finally {
      setSaving(false);
    }
  }

  function onEmptyAction() {
    if (hasFilters) {
      setQuery("");
      setScope("all");
    } else {
      openAddMethod();
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* top-[60px] instead of top-0: AppShell (Menu.md) now renders its
          own sticky app bar above this page, so this header needs to stick
          just below it rather than at the very top of the viewport. */}
      <header className="sticky top-[60px] z-[3] flex flex-col gap-[14px] border-b border-border bg-surface-0 px-md pb-[12px] pt-[22px]">
        <div className="flex items-center gap-sm">
          <div className="relative flex-1">
            {/* Discrete search glyph, not shelf-sense-ds's plain-emoji icon
                convention (Menu.md's ▤/⚙/☰) — a colorful 🔍 emoji read as
                too loud sitting inside a text field. currentColor inline
                SVG instead, same construction Button.tsx's own spinner
                uses, so it's monochrome and themes with ink-muted. */}
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
              style={{ paddingLeft: 34 }}
              placeholder={t("inventory.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button size="sm" className="h-11 flex-shrink-0" onClick={openAddMethod}>
            {t("inventory.addButton")}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-sm">
          <ScopeTile
            active={scope === "all"}
            count={all.length}
            label={t("inventory.scopeAllItems")}
            activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
            onClick={() => setScope("all")}
          />
          <ScopeTile
            active={scope === "attention"}
            count={countAttention}
            label={t("inventory.scopeAttention")}
            activeClassName="border-warning bg-warning-bg text-warning"
            hoverClassName="hover:border-warning"
            onClick={() => setScope((s) => (s === "attention" ? "all" : "attention"))}
          />
          <ScopeTile
            active={scope === "low"}
            count={countLow}
            label={t("inventory.scopeLowStock")}
            activeClassName="border-info bg-info-bg text-info"
            hoverClassName="hover:border-info"
            onClick={() => setScope((s) => (s === "low" ? "all" : "low"))}
          />
        </div>

        <div className="flex items-center justify-between gap-[12px] pb-[2px]">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            {i18n.tPlural("inventory.count", filtered.length)}
          </span>
          <div className="flex items-center gap-[6px]">
            <span className="text-[11px] uppercase tracking-[0.04em] text-ink-muted">{t("inventory.sort")}</span>
            <div className="flex gap-[2px] rounded-full bg-surface-2 p-[2px]">
              <SortButton active={sortBy === "soonest"} onClick={() => setSortBy("soonest")} label={t("inventory.sortSoonest")} />
              <SortButton active={sortBy === "alpha"} onClick={() => setSortBy("alpha")} label={t("inventory.sortAlpha")} />
            </div>
          </div>
        </div>
      </header>

      {justSavedMessage && (
        <div className="px-md pt-sm">
          <Alert variant="success" title={justSavedMessage} />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-[64px] text-[13px] text-ink-muted">
            {t("inventory.loading")}
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <Alert variant="danger" title={t("inventory.loadError")}>
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
                <span className={cn("h-[7px] w-[7px] flex-shrink-0 rounded-full", groupDotClass(g.status))} />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[11px] text-ink-muted">{g.count}</span>
              </div>
              {g.products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  expanded={!!expanded[p.id]}
                  onToggle={() => toggleExpanded(p.id)}
                  slideX={drag && drag.id === p.id ? drag.dx : swipedId === p.id ? -76 : 0}
                  dragging={!!(drag && drag.id === p.id)}
                  onPressStart={(e) => handlePressStart(p.id, p.totalQty, e)}
                  onPressMove={handlePressMove}
                  onPressEnd={(e) => handlePressEnd(p.id, e)}
                  onPressAbort={handlePressAbort}
                  onOpenQuick={() => openQuickFromSwipe(p.id, p.totalQty)}
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
              {hasFilters ? t("inventory.emptyNothingMatches") : t("inventory.emptyPantryEmpty")}
            </div>
            <div className="max-w-[260px] text-[13px] text-ink-secondary">
              {hasFilters ? t("inventory.emptyClearFiltersHint") : t("inventory.emptyAddFirstHint")}
            </div>
            <Button onClick={onEmptyAction}>{hasFilters ? t("inventory.clearFilters") : t("inventory.addFirstProduct")}</Button>
          </div>
        )}
      </div>

      <AddProductModals
        step={addStep}
        form={addForm}
        prefillSource={addSource}
        defaults={listDefaults}
        onCloseAll={closeAddFlow}
        onScan={() => setAddStep("scan")}
        onPhoto={() => setAddStep("photo")}
        onManual={openManual}
        onCaptureDone={completeCapture}
        onUseThis={useMatchedProduct}
        onAddAsNew={() => setAddStep("unlink")}
        onBackToMatch={() => setAddStep("match")}
        onConfirmUnlink={confirmUnlink}
        onClearPrefill={clearPrefill}
        onFieldChange={setFormField}
        onSave={saveProduct}
        saving={saving}
        saveError={saveError}
      />

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

function groupDotClass(status: EnrichedProduct["status"] | "alpha"): string {
  switch (status) {
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

function accentBarClass(status: EnrichedProduct["status"]): string {
  switch (status) {
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

function SortButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border-none px-[11px] py-[5px] text-[12px] font-semibold",
        active ? "bg-surface-0 text-ink-primary shadow-sm" : "bg-transparent text-ink-muted",
      )}
    >
      {label}
    </button>
  );
}

function ScopeTile({
  active,
  count,
  label,
  activeClassName,
  hoverClassName,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  activeClassName: string;
  hoverClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-[6px] rounded-lg border px-[12px] py-[10px] text-left",
        active ? activeClassName : cn("border-border bg-surface-1 text-ink-secondary", hoverClassName),
      )}
    >
      <span className="font-mono text-[22px] font-semibold leading-none">{count}</span>
      <span className="text-[11px] uppercase tracking-[0.04em] opacity-75">{label}</span>
    </button>
  );
}

function ProductRow({
  product: p,
  expanded,
  onToggle,
  slideX,
  dragging,
  onPressStart,
  onPressMove,
  onPressEnd,
  onPressAbort,
  onOpenQuick,
}: {
  product: EnrichedProduct;
  expanded: boolean;
  onToggle: () => void;
  /** Current horizontal offset in px (0 = closed, -76 = swipe panel revealed, or a live drag value in between). */
  slideX: number;
  /** True mid-drag — disables the snap transition so the row tracks the pointer 1:1. */
  dragging: boolean;
  onPressStart: (e: ReactPointerEvent) => void;
  onPressMove: (e: ReactPointerEvent) => void;
  onPressEnd: (e: ReactPointerEvent) => void;
  onPressAbort: () => void;
  onOpenQuick: () => void;
}) {
  const { t } = useT();
  const metaLabel =
    (p.batches.length > 1 ? t("inventory.batchesCountPrefix", { count: p.batches.length }) : "") +
    (p.batches[0]?.expiryLabel ?? t("freshness.doesNotExpire"));

  return (
    <div className="-mb-px flex border-b border-t border-border">
      <div className={cn("w-[3px] flex-shrink-0", accentBarClass(p.status))} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Swipe-revealed quick-batch-edit action, pinned behind the row. */}
        <div className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center border-l border-border bg-surface-2">
          <button
            type="button"
            onClick={onOpenQuick}
            title={t("common.quickBatchEditLabel")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-0 text-sm tracking-[0.08em] text-ink-primary"
          >
            •••
          </button>
        </div>
        <div
          onPointerDown={onPressStart}
          onPointerMove={onPressMove}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressAbort}
          onContextMenu={(e) => e.preventDefault()}
          className="relative bg-surface-0"
          style={{
            transform: `translateX(${slideX}px)`,
            transition: dragging ? "none" : "transform 180ms ease",
            touchAction: "pan-y",
          }}
        >
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-md px-md py-[13px] text-left"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex items-center gap-sm">
                <span className="truncate text-[15px] font-semibold">{p.short_description}</span>
                {p.isLow && (
                  <span className="flex-shrink-0 rounded-full bg-info-bg px-sm py-[2px] font-mono text-[10px] tracking-[0.06em] text-info">
                    {t("inventory.lowBadge")}
                  </span>
                )}
              </div>
              <span className="truncate text-[12px] text-ink-muted">{metaLabel}</span>
            </div>
            <span className="flex-shrink-0 font-mono text-[17px] font-semibold text-ink-primary">{p.totalQty}</span>
            <FreshnessBadge status={p.status} label={freshnessBadgeLabel(p.status, t)} />
            <span
              className={cn(
                "flex-shrink-0 text-[11px] text-ink-muted transition-transform",
                expanded ? "rotate-180" : "rotate-0",
              )}
            >
              ▼
            </span>
          </button>
          {expanded && (
            <div className="flex flex-col gap-sm px-md pb-[14px]">
              {p.batches.map((b) => (
                <div key={b.id} className="flex items-center gap-[10px] rounded-md bg-surface-2 px-[11px] py-[9px]">
                  <span className="min-w-[34px] font-mono text-[12px] font-semibold text-ink-primary">
                    {b.qtyLabel}
                  </span>
                  <span className="flex-1 truncate text-[12px] text-ink-secondary">{b.expiryLabel}</span>
                  <FreshnessBadge status={b.status} label={freshnessBadgeLabel(b.status, t)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
