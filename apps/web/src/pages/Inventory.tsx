import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Footer, FreshnessBadge, Input, Popover, PopoverItem, cn } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { ScopeTile } from "../components/ScopeTile";
import { freshnessBadgeLabel } from "../lib/freshness";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import { ApiError, createBatch, lookupBarcode, updateBatch, updateProduct } from "../lib/api";
import { isBarcodeScanSupported } from "../lib/barcodeScanner";
import type { AddProductLocationState } from "./AddProduct";
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
  bumpQuickEdit,
  commitQuickEditDraft,
  openQuickEditState,
  planQuickEdit,
  resetQuickEdit,
  type QuickEditState,
} from "../lib/quickBatchEdit";
import {
  addAlias,
  addBarcode,
  armSave,
  buildEditProductPayload,
  buildSaveResult,
  cancelAddBarcodeScan,
  cancelConfirm,
  changeBarcodeDesc,
  commitBarcodeDescEdit,
  confirmAliasMove,
  confirmBarcodeMove,
  openAddBarcode,
  openProductEditState,
  prefillNewBarcodeFromScan,
  removeAlias,
  removeSelectedBarcodes,
  setDoesExpire,
  setField,
  setNewAlias,
  setNewBarcodeCode,
  setNewBarcodeDesc,
  startAddBarcodeLookup,
  startEditBarcodeDesc,
  toggleAddBarcode,
  toggleBarcodeSelected,
  toggleSelectAllBarcodes,
  type ProductEditState,
} from "../lib/productEdit";
import { BarcodeCaptureModal } from "../components/BarcodeCaptureModal";
import { QuickBatchEditModal } from "../components/QuickBatchEditModal";
import { PriceHistoryModal } from "../components/PriceHistoryModal";
import { ProductEditView } from "../components/ProductEditView";
import { usePriceHistory } from "../lib/usePriceHistory";

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
 * /products — see productsStore.tsx and lib/api.ts). The Add flow is now
 * barcode-scan-first (specs/Barcode Scanner & Product info scrape.md):
 * "+ Add" opens BarcodeCaptureModal directly when the browser supports it;
 * a local match jumps straight into Quick Batch Edit, a miss looks the code
 * up (Open Food Facts, then Tavily+AI) and hands off to the real
 * /products/add route. The old method-choice/photo/match-review/unlink
 * modals and MOCK_BARCODE_MATCH are retired, not just unused.
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
  const location = useLocation();
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(
    () => (location.state as AddProductLocationState | null)?.justSavedMessage ?? null,
  );
  // --- Add Product flow: barcode-scan-first entry (specs/Barcode Scanner &
  // Product info scrape.md) — "+ Add" opens this capture modal directly
  // when the browser supports it; everything past a successful/cancelled
  // scan is real navigation to /products/add, not local modal state.
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // --- Product Edit ------------------------------------------------------
  const [edit, setEdit] = useState<ProductEditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  // --- Quick Batch Edit: hold-to-open / swipe-to-reveal row gestures -----
  const [quick, setQuick] = useState<QuickEditState | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  // --- Row actions popover: the "•••" swipe button, converted from a
  // direct Quick Batch Edit shortcut into a real menu (specs/Price
  // History.md) — same PopoverState shape ProductList.tsx's own "⋯" uses.
  const [rowActions, setRowActions] = useState<{ productId: string; total: number; mode: "units" | "percentage"; x: number; y: number } | null>(
    null,
  );
  // specs/Price History.md
  const priceHistory = usePriceHistory(t("priceHistory.generalLabel"));
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  // Mutable, non-render-triggering bookkeeping for the in-flight gesture —
  // must be read synchronously inside pointer handlers, not via state.
  const pressRef = useRef<{ id: string; x: number; y: number; moved: boolean; fired: boolean } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  // A hold or swipe suppresses the *next* row click so opening the modal
  // (or revealing the swipe panel) never also toggles the row's expand.
  const suppressClickRef = useRef(false);

  const savedMessageTimer = useRef<number | null>(null);
  // Consumes the one-shot "just saved"/"just linked" message AddProduct.tsx
  // hands back via navigate(backTo, { state }) — cleared from history state
  // immediately so a later back/forward through this entry doesn't re-show
  // it, and auto-dismissed the same way an in-page save's message already is.
  useEffect(() => {
    if ((location.state as AddProductLocationState | null)?.justSavedMessage) {
      navigate(location.pathname, { replace: true, state: {} });
      savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount only
  }, []);
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
      minimalPercentage: preferences.default_minimal_percentage,
    }),
    [preferences.default_freshness_threshold_days, preferences.default_minimal_quantity, preferences.default_minimal_percentage],
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

  function openQuick(id: string, total: number, mode: "units" | "percentage") {
    setQuick(openQuickEditState(id, total, mode));
  }
  function openQuickFromSwipe(id: string, total: number, mode: "units" | "percentage") {
    setSwipedId(null);
    openQuick(id, total, mode);
  }

  // --- Row actions popover -------------------------------------------------

  function openRowActions(e: ReactMouseEvent<HTMLButtonElement>, id: string, total: number, mode: "units" | "percentage") {
    e.stopPropagation();
    setSwipedId(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setRowActions({ productId: id, total, mode, x: Math.max(8, rect.right - 158), y: rect.bottom + 6 });
  }
  function rowActionsEditStock() {
    if (!rowActions) return;
    const { productId, total, mode } = rowActions;
    setRowActions(null);
    // Same call the "•••" button made directly before it became a menu.
    openQuickFromSwipe(productId, total, mode);
  }
  function rowActionsPriceHistory() {
    if (!rowActions) return;
    const product = products.find((p) => p.id === rowActions.productId);
    setRowActions(null);
    if (product) priceHistory.open(product, batches.filter((b) => b.product_id === product.id));
  }

  // Long-press: pointer down starts a threshold timer; any real movement
  // (scroll or swipe) cancels it before it fires.
  function handlePressStart(id: string, total: number, mode: "units" | "percentage", e: ReactPointerEvent) {
    if (e.button && e.button !== 0) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = { id, x: e.clientX, y: e.clientY, moved: false, fired: false };
    holdTimerRef.current = window.setTimeout(() => {
      const press = pressRef.current;
      if (!press || press.moved) return;
      press.fired = true;
      setSwipedId(null);
      setDrag(null);
      openQuick(id, total, mode);
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
  function quickAddPriceChange(value: string) {
    setQuick((q) => (q ? { ...q, addPrice: value } : q));
  }
  function quickAddBarcodeIdChange(value: string) {
    setQuick((q) => (q ? { ...q, addBarcodeId: value || null } : q));
  }
  function quickReset() {
    setQuick((q) => (q ? resetQuickEdit(q) : q));
    setQuickSaveError(null);
  }
  /**
   * specs/Prices & Product Differentiation.md — Quick Batch Edit had no
   * real apps/api wiring before this spec (Save just spliced local
   * `batches` state). Now plans the same soonest-expiring-first cascade
   * as before (planQuickEdit), then applies it via the real batch-mutation
   * endpoints: one PATCH per existing batch that needs its quantity
   * changed (reaching 0 marks it consumed server-side), one POST for the
   * new batch if the net delta is positive.
   */
  async function quickSave() {
    if (!quick) return;
    const product = products.find((p) => p.id === quick.productId);
    if (!product) {
      setQuick(null);
      return;
    }
    if (product.tracking_mode === "percentage") {
      // specs/Relative Tracking.md: overwrites stock_percent directly —
      // no Batch is ever created or cascaded through for this mode.
      setProducts((ps) => ps.map((p) => (p.id === product.id ? { ...p, stock_percent: quick.target } : p)));
      setQuick(null);
      return;
    }
    const delta = quick.target - quick.base;
    if (delta === 0) {
      setQuick(null);
      return;
    }
    setQuickSaving(true);
    setQuickSaveError(null);
    try {
      const productBatches = batches.filter((b) => b.product_id === quick.productId);
      const plan = planQuickEdit(productBatches, product.does_expire, delta, quick.addExpiresOn, quick.addPrice, quick.addBarcodeId);
      const updated = await Promise.all(
        plan.updates.map((u) => updateBatch(quick.productId, u.batchId, { quantity: u.quantity })),
      );
      const created = plan.create ? await createBatch(quick.productId, plan.create) : null;
      setBatches((bs) => {
        const byId = new Map(updated.map((u) => [u.batch.id, u.batch]));
        // A batch reaching 0 is consumed server-side — same "invisible in
        // every active view" rule GET /products applies, so it's dropped
        // from local state here too rather than lingering at quantity 0.
        const next = bs.map((b) => byId.get(b.id) ?? b).filter((b) => !byId.has(b.id) || byId.get(b.id)!.quantity > 0);
        return created ? [created.batch, ...next] : next;
      });
      setQuick(null);
    } catch (err) {
      setQuickSaveError(err instanceof ApiError ? err.message : t("inventory.genericSaveError"));
    } finally {
      setQuickSaving(false);
    }
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
  function editFieldChange(key: "short" | "minQty" | "fresh" | "minPercent", value: string) {
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
  function editOpenAddBarcode() {
    if (edit) setEdit(openAddBarcode(edit, isBarcodeScanSupported()));
  }
  async function editAddBarcodeDetect(code: string) {
    if (!edit) return;
    setEdit(startAddBarcodeLookup(edit));
    const lookup = await lookupBarcode(code);
    setEdit((current) => (current ? prefillNewBarcodeFromScan(current, code, lookup.long_description || "") : current));
  }
  function editCancelAddBarcodeScan() {
    if (edit) setEdit(cancelAddBarcodeScan(edit));
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

  // --- Add Product flow: barcode-scan-first (specs/Barcode Scanner &
  // Product info scrape.md) ---------------------------------------------

  function openAdd() {
    if (isBarcodeScanSupported()) {
      setScanOpen(true);
    } else {
      navigate("/products/add", { state: { from: "/" } satisfies AddProductLocationState });
    }
  }

  async function handleDetect(code: string) {
    setScanOpen(false);
    // Real, offline-capable local match — checks every already-loaded
    // product's own barcodes, no network call. Retires MOCK_BARCODE_MATCH.
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
      navigate("/products/add", { state: { barcode: code, lookup, from: "/" } satisfies AddProductLocationState });
    } finally {
      setLookupLoading(false);
    }
  }

  function handleCancelScan() {
    setScanOpen(false);
    navigate("/products/add", { state: { from: "/" } satisfies AddProductLocationState });
  }

  function onEmptyAction() {
    if (hasFilters) {
      setQuery("");
      setScope("all");
    } else {
      openAdd();
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
          <Button size="sm" className="h-11 flex-shrink-0" onClick={openAdd}>
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
      {lookupLoading && (
        <div className="px-md pt-sm">
          <Alert variant="info" title={t("addProduct.lookingUpProduct")} />
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
                  onPressStart={(e) => handlePressStart(p.id, p.totalQty, p.tracking_mode, e)}
                  onPressMove={handlePressMove}
                  onPressEnd={(e) => handlePressEnd(p.id, e)}
                  onPressAbort={handlePressAbort}
                  onOpenActions={(e) => openRowActions(e, p.id, p.totalQty, p.tracking_mode)}
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
        onAddPriceChange={quickAddPriceChange}
        onAddBarcodeIdChange={quickAddBarcodeIdChange}
        onReset={quickReset}
        onSave={quickSave}
        onStock={() => quick && openStock(quick.productId)}
        onEditProduct={() => quick && openProductEdit(quick.productId)}
        saving={quickSaving}
        saveError={quickSaveError}
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
        onOpenAddBarcode={editOpenAddBarcode}
        onToggleAddBarcode={editToggleAddBarcode}
        onNewBarcodeDescChange={editNewBarcodeDescChange}
        onNewBarcodeCodeChange={editNewBarcodeCodeChange}
        onAddBarcode={editAddBarcode}
        onAddBarcodeDetect={editAddBarcodeDetect}
        onCancelAddBarcodeScan={editCancelAddBarcodeScan}
        onRemoveSelectedBarcodes={editRemoveSelectedBarcodes}
        onConfirmMove={editConfirmMove}
        onCancelConfirm={editCancelConfirm}
        onSave={editSave}
        saving={editSaving}
        saveError={editSaveError}
      />

      <Popover
        open={!!rowActions}
        onClose={() => setRowActions(null)}
        position={rowActions ? { x: rowActions.x, y: rowActions.y } : { x: 0, y: 0 }}
      >
        <PopoverItem onClick={rowActionsEditStock}>{t("productList.popoverEditStock")}</PopoverItem>
        {/* specs/Price History.md: percentage-tracked products carry no
            Batch rows at all — nothing to plot, same disabled treatment
            ProductList.tsx's own popover gives this case. */}
        {rowActions?.mode === "percentage" ? (
          <PopoverItem disabled title={t("quickBatchEdit.stockDisabledPercentTitle")} className="cursor-not-allowed opacity-50">
            {t("productList.popoverPriceHistory")}
          </PopoverItem>
        ) : (
          <PopoverItem onClick={rowActionsPriceHistory}>{t("productList.popoverPriceHistory")}</PopoverItem>
        )}
      </Popover>

      <PriceHistoryModal
        open={!!priceHistory.state}
        product={priceHistory.state?.product ?? null}
        series={priceHistory.state?.series ?? []}
        visibleKeys={priceHistory.state?.visibleKeys ?? new Set()}
        loading={priceHistory.state?.loading ?? false}
        error={priceHistory.state?.error ?? null}
        onToggleSeries={priceHistory.toggleSeries}
        onClose={priceHistory.close}
        onJumpToQuickBatchEdit={() => {
          const product = priceHistory.state?.product;
          priceHistory.close();
          if (product) {
            const total =
              product.tracking_mode === "percentage"
                ? (product.stock_percent ?? 0)
                : batches.filter((b) => b.product_id === product.id).reduce((sum, b) => sum + b.quantity, 0);
            openQuick(product.id, total, product.tracking_mode);
          }
        }}
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
  onOpenActions,
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
  /** Opens the row actions popover (Edit Stock / Price History) — specs/Price History.md. Was a direct Quick Batch Edit shortcut before that spec. */
  onOpenActions: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useT();
  const isPercentage = p.tracking_mode === "percentage";
  const metaLabel = isPercentage
    ? t("inventory.percentTrackedMeta")
    : (p.batches.length > 1 ? t("inventory.batchesCountPrefix", { count: p.batches.length }) : "") +
      (p.batches[0]?.expiryLabel ?? t("freshness.doesNotExpire"));

  return (
    <div className="-mb-px flex border-b border-t border-border">
      <div className={cn("w-[3px] flex-shrink-0", accentBarClass(p.status))} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Swipe-revealed quick-batch-edit action, pinned behind the row. */}
        <div className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center border-l border-border bg-surface-2">
          <button
            type="button"
            onClick={onOpenActions}
            title={t("productList.rowActionsLabel")}
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
            <span className="flex-shrink-0 font-mono text-[17px] font-semibold text-ink-primary">
              {p.totalQty}
              {isPercentage && "%"}
            </span>
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
              {isPercentage ? (
                <p className="text-xs text-ink-muted">{t("inventory.percentTrackedExpandNote")}</p>
              ) : (
                p.batches.map((b) => (
                  <div key={b.id} className="flex items-center gap-[10px] rounded-md bg-surface-2 px-[11px] py-[9px]">
                    <span className="min-w-[34px] font-mono text-[12px] font-semibold text-ink-primary">
                      {b.qtyLabel}
                    </span>
                    <span className="flex-1 truncate text-[12px] text-ink-secondary">{b.expiryLabel}</span>
                    <FreshnessBadge status={b.status} label={freshnessBadgeLabel(b.status, t)} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
