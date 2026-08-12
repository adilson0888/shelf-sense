import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Alert, Button, FreshnessBadge, Input, cn } from "shelf-sense-ds";
import { mockBatches, mockProducts } from "../mocks/products";
import {
  type EnrichedProduct,
  type ListScope,
  enrichProduct,
  groupAlphabetically,
  groupByStatus,
  matchesScope,
  matchesSearch,
} from "../lib/productList";
import { BLANK_FORM, buildNewProduct, type AddFlowStep, type AddProductFormState, type PrefillSource, MOCK_BARCODE_MATCH } from "../lib/addProduct";
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
import type { Batch, Product } from "../types";

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
 * Real data wiring (apps/api) doesn't exist yet — see mocks/products.ts.
 * The Add flow's scan/photo/match steps are simulated (MOCK_BARCODE_MATCH)
 * for the same reason — no real barcode-lookup or vision-identify endpoint
 * exists yet (Product Add.md).
 */
export function ProductListPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ListScope>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "alpha">("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [batches, setBatches] = useState<Batch[]>(mockBatches);
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(null);

  const [addStep, setAddStep] = useState<AddFlowStep>("idle");
  const [addSource, setAddSource] = useState<PrefillSource>(null);
  const [addForm, setAddForm] = useState<AddProductFormState>(BLANK_FORM);

  // --- Product Edit ------------------------------------------------------
  const [edit, setEdit] = useState<ProductEditState | null>(null);

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

  const all = useMemo(
    () =>
      products.map((p) =>
        enrichProduct(
          p,
          batches.filter((b) => b.product_id === p.id),
          today,
        ),
      ),
    [products, batches, today],
  );

  const filtered = useMemo(
    () => all.filter((p) => matchesSearch(p, query) && matchesScope(p, scope)),
    [all, query, scope],
  );

  const groups = useMemo(
    () => (sortBy === "alpha" ? groupAlphabetically(filtered) : groupByStatus(filtered)),
    [filtered, sortBy],
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

  // --- Product Edit -----------------------------------------------------

  function openProductEdit(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setQuick(null);
    setEdit(openProductEditState(product));
  }
  function editClose() {
    setEdit(null);
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
    if (edit) setEdit(addAlias(edit, products));
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
  function editSave() {
    if (!edit) return;
    if (!edit.saveArmed) {
      setEdit(armSave(edit, products));
      return;
    }
    const product = products.find((p) => p.id === edit.productId);
    if (!product) {
      setEdit(null);
      return;
    }
    const { updatedProduct, otherProductUpdates } = buildSaveResult(edit, product);
    setProducts((ps) =>
      ps.map((p) => {
        if (p.id === updatedProduct.id) return updatedProduct;
        const upd = otherProductUpdates.find((u) => u.productId === p.id);
        if (!upd) return p;
        return {
          ...p,
          barcodes: p.barcodes.filter((b) => !upd.removeBarcodeCodes.includes(b.code)),
          aliases: p.aliases.filter((a) => !upd.removeAliases.includes(a)),
        };
      }),
    );
    if (!updatedProduct.does_expire) {
      setBatches((bs) => bs.map((b) => (b.product_id === updatedProduct.id ? { ...b, expires_on: null } : b)));
    }
    setJustSavedMessage(`"${updatedProduct.short_description}" updated.`);
    if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
    savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
    setEdit(null);
  }

  // --- Add Product flow -----------------------------------------------

  function openAddMethod() {
    setAddStep("method");
    setAddSource(null);
    setAddForm(BLANK_FORM);
    setJustSavedMessage(null);
  }
  function closeAddFlow() {
    setAddStep("idle");
    setAddSource(null);
  }
  function openManual() {
    setAddSource(null);
    setAddForm(BLANK_FORM);
    setAddStep("form");
  }
  function completeCapture() {
    if (addStep === "photo") {
      setAddSource("photo");
      setAddForm({ ...BLANK_FORM, short: "Grated cheese", long: MOCK_BARCODE_MATCH.long, qty: "1" });
      setAddStep("form");
    } else {
      setAddStep("match");
    }
  }
  function useMatchedProduct() {
    setAddSource("match-use");
    setAddForm({
      ...BLANK_FORM,
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
    setAddForm(BLANK_FORM);
  }
  function setFormField<K extends keyof AddProductFormState>(key: K, value: AddProductFormState[K]) {
    setAddForm((f) => ({ ...f, [key]: value }));
  }

  function saveProduct() {
    const { product, batch } = buildNewProduct(addForm);
    setProducts((ps) => [product, ...ps]);
    if (batch) setBatches((bs) => [batch, ...bs]);
    setJustSavedMessage("Product added.");
    setAddStep("idle");
    setAddSource(null);
    setAddForm(BLANK_FORM);
    setQuery("");
    setScope("all");

    if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
    savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
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
    <div className="dark mx-auto flex min-h-screen max-w-[420px] flex-col bg-surface-1 font-sans text-ink-primary">
      <header className="sticky top-0 z-[3] flex flex-col gap-[14px] border-b border-border bg-surface-0 px-md pb-[12px] pt-[22px]">
        <div className="flex items-end justify-between gap-[12px]">
          <div className="flex flex-col gap-[2px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">Pantry</span>
            <h1 className="m-0 text-[26px] font-bold leading-[1.1] tracking-[-0.02em]">Inventory</h1>
          </div>
          <Button size="sm" onClick={openAddMethod}>
            + Add
          </Button>
        </div>

        <Input
          className="h-11"
          placeholder="Search name or alias"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-sm">
          <ScopeTile
            active={scope === "all"}
            count={all.length}
            label="All items"
            activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
            onClick={() => setScope("all")}
          />
          <ScopeTile
            active={scope === "attention"}
            count={countAttention}
            label="Attention"
            activeClassName="border-warning bg-warning-bg text-warning"
            hoverClassName="hover:border-warning"
            onClick={() => setScope((s) => (s === "attention" ? "all" : "attention"))}
          />
          <ScopeTile
            active={scope === "low"}
            count={countLow}
            label="Low stock"
            activeClassName="border-info bg-info-bg text-info"
            hoverClassName="hover:border-info"
            onClick={() => setScope((s) => (s === "low" ? "all" : "low"))}
          />
        </div>

        <div className="flex items-center justify-between gap-[12px] pb-[2px]">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </span>
          <div className="flex items-center gap-[6px]">
            <span className="text-[11px] uppercase tracking-[0.04em] text-ink-muted">Sort</span>
            <div className="flex gap-[2px] rounded-full bg-surface-2 p-[2px]">
              <SortButton active={sortBy === "soonest"} onClick={() => setSortBy("soonest")} label="Soonest" />
              <SortButton active={sortBy === "alpha"} onClick={() => setSortBy("alpha")} label="A–Z" />
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
        {filtered.length > 0 ? (
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
            <div className="text-[16px] font-semibold">{hasFilters ? "Nothing matches" : "Your pantry is empty"}</div>
            <div className="max-w-[260px] text-[13px] text-ink-secondary">
              {hasFilters
                ? "Clear the search or switch back to All items."
                : "Add your first product to start tracking batches and expirations."}
            </div>
            <Button onClick={onEmptyAction}>{hasFilters ? "Clear filters" : "+ Add a product"}</Button>
          </div>
        )}
      </div>

      <AddProductModals
        step={addStep}
        form={addForm}
        prefillSource={addSource}
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
  const metaLabel =
    (p.batches.length > 1 ? `${p.batches.length} batches · ` : "") +
    (p.batches[0]?.expiryLabel ?? "Does not expire");

  return (
    <div className="-mb-px flex border-b border-t border-border">
      <div className={cn("w-[3px] flex-shrink-0", accentBarClass(p.status))} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Swipe-revealed quick-batch-edit action, pinned behind the row. */}
        <div className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center border-l border-border bg-surface-2">
          <button
            type="button"
            onClick={onOpenQuick}
            title="Quick batch edit"
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
                    LOW
                  </span>
                )}
              </div>
              <span className="truncate text-[12px] text-ink-muted">{metaLabel}</span>
            </div>
            <span className="flex-shrink-0 font-mono text-[17px] font-semibold text-ink-primary">{p.totalQty}</span>
            <FreshnessBadge status={p.status} />
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
                  <FreshnessBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
