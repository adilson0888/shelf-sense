import { useEffect, useMemo, useRef, useState } from "react";
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
import { AddProductModals } from "../components/AddProductModals";
import type { Batch, Product } from "../types";

const PENDING_ICON_DELAY_MS = 2600;

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
 * for the same reason — no real barcode-lookup, vision-identify, or
 * icon-generate endpoint exists yet (Product Add.md).
 */
export function ProductListPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ListScope>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "alpha">("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [batches, setBatches] = useState<Batch[]>(mockBatches);
  const [pendingIconIds, setPendingIconIds] = useState<ReadonlySet<string>>(new Set());
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(null);

  const [addStep, setAddStep] = useState<AddFlowStep>("idle");
  const [addSource, setAddSource] = useState<PrefillSource>(null);
  const [addForm, setAddForm] = useState<AddProductFormState>(BLANK_FORM);

  const pendingTimers = useRef<number[]>([]);
  useEffect(() => () => pendingTimers.current.forEach(clearTimeout), []);

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

  function toggleExpanded(id: string) {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
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
    setPendingIconIds((ids) => new Set(ids).add(product.id));
    setJustSavedMessage("Product added — generating its icon in the background.");
    setAddStep("idle");
    setAddSource(null);
    setAddForm(BLANK_FORM);
    setQuery("");
    setScope("all");

    const t1 = window.setTimeout(() => {
      setPendingIconIds((ids) => {
        const next = new Set(ids);
        next.delete(product.id);
        return next;
      });
    }, PENDING_ICON_DELAY_MS);
    const t2 = window.setTimeout(() => setJustSavedMessage(null), PENDING_ICON_DELAY_MS + 2200);
    pendingTimers.current.push(t1, t2);
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
                  pending={pendingIconIds.has(p.id)}
                  onToggle={() => toggleExpanded(p.id)}
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
  pending,
  onToggle,
}: {
  product: EnrichedProduct;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const metaLabel =
    (p.batches.length > 1 ? `${p.batches.length} batches · ` : "") +
    (p.batches[0]?.expiryLabel ?? "Does not expire");

  return (
    <div className="-mb-px flex border-b border-t border-border bg-surface-0">
      <div className={cn("w-[3px] flex-shrink-0", accentBarClass(p.status))} />
      <div className="min-w-0 flex-1">
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
              {pending && (
                <span
                  title="Generating icon…"
                  className="flex flex-shrink-0 animate-pulse items-center gap-1 rounded-full bg-surface-2 px-sm py-[2px] font-mono text-[10px] tracking-[0.06em] text-ink-muted"
                >
                  <span className="h-2 w-2 rounded-sm bg-border-strong" />
                  ICON
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
  );
}
