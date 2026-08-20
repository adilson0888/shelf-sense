import { useRef, useState } from "react";
import { ApiError, fetchConsumedBatches, searchPrices, type PriceSearchRow } from "./api";
import { buildPriceHistorySeries, GENERAL_SERIES_KEY, type PriceSeries } from "./priceHistory";
import type { Batch, Product } from "../types";

// specs/Price comparison.md — a search snapshot at the moment "Search
// prices" was last clicked. "idle" = never run this open; the matrix
// intentionally does NOT auto-refresh when the legend is toggled
// afterward (that spec's Out of scope).
export type PriceSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; rows: PriceSearchRow[] }
  | { status: "error"; message: string };

export interface PriceHistoryState {
  product: Product;
  series: PriceSeries[];
  // Legend-toggle visibility — kept here rather than lifted to the owning
  // page's own useState (unlike quick/edit/popover there): nothing outside
  // this modal needs it, and it should reset every time the modal (re)opens,
  // which living inside this hook gives for free.
  visibleKeys: Set<string>;
  loading: boolean;
  error: string | null;
  // specs/Price comparison.md — same "resets for free on (re)open" reasoning
  // as visibleKeys above; nothing outside this modal needs it either.
  priceSearch: PriceSearchState;
}

/**
 * specs/Price History.md — shared by both ProductList.tsx and Inventory.tsx
 * (each page calls its own instance of this hook, same as they each already
 * duplicate their own `quick`/`edit`/`popover` state). Fetches a product's
 * consumed batches on demand and merges them with the active batches the
 * page already has from useProductsStore, so there's one real network call
 * per open rather than eagerly loading history for every product up front.
 */
export function usePriceHistory(generalLabel: string) {
  const [state, setState] = useState<PriceHistoryState | null>(null);
  // Guards against a slow first fetch resolving after a second open() call
  // for a different product has already superseded it.
  const requestIdRef = useRef(0);

  async function open(product: Product, activeBatches: Batch[]) {
    const requestId = ++requestIdRef.current;
    setState({ product, series: [], visibleKeys: new Set(), loading: true, error: null, priceSearch: { status: "idle" } });

    let consumedBatches: Batch[];
    try {
      ({ batches: consumedBatches } = await fetchConsumedBatches(product.id));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setState({
        product,
        series: [],
        visibleKeys: new Set(),
        loading: false,
        error: err instanceof ApiError ? err.message : "Couldn't load price history.",
        priceSearch: { status: "idle" },
      });
      return;
    }
    if (requestIdRef.current !== requestId) return;

    const series = buildPriceHistorySeries([...activeBatches, ...consumedBatches], product.barcodes, generalLabel);
    setState({
      product,
      series,
      visibleKeys: new Set(series.map((s) => s.key)),
      loading: false,
      error: null,
      priceSearch: { status: "idle" },
    });
  }

  function close() {
    requestIdRef.current++; // orphan any in-flight fetch
    setState(null);
  }

  function toggleSeries(key: string) {
    setState((s) => {
      if (!s) return s;
      const visibleKeys = new Set(s.visibleKeys);
      if (visibleKeys.has(key)) visibleKeys.delete(key);
      else visibleKeys.add(key);
      return { ...s, visibleKeys };
    });
  }

  /**
   * specs/Price comparison.md — searches every currently-visible *real*
   * barcode (visibleKeys minus the synthetic "General" line, which has no
   * real barcode to search by) against every saved comparison site. A
   * snapshot at click time: toggling the legend afterward doesn't re-run
   * this automatically, per that spec's Out of scope.
   */
  async function runPriceSearch() {
    const s = state;
    if (!s) return;
    const barcodeIds = [...s.visibleKeys].filter((k) => k !== GENERAL_SERIES_KEY);
    if (barcodeIds.length === 0) return;

    const requestId = requestIdRef.current;
    setState((cur) => (cur ? { ...cur, priceSearch: { status: "loading" } } : cur));
    try {
      const { rows } = await searchPrices(barcodeIds);
      if (requestIdRef.current !== requestId) return; // modal closed/reopened for another product mid-search
      setState((cur) => (cur ? { ...cur, priceSearch: { status: "done", rows } } : cur));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof ApiError ? err.message : "Couldn't compare prices.";
      setState((cur) => (cur ? { ...cur, priceSearch: { status: "error", message } } : cur));
    }
  }

  return { state, open, close, toggleSeries, runPriceSearch };
}
