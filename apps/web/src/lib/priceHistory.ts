import type { Barcode, Batch } from "../types";

/** Synthetic series key for batches with no linked barcode (barcode_id === null) — specs/Price History.md's "General" line. */
export const GENERAL_SERIES_KEY = "general";

export interface PricePoint {
  batchId: string;
  createdAt: string; // full ISO instant
  price: number;
}

export interface PriceSeries {
  key: string; // barcode.id, or GENERAL_SERIES_KEY
  label: string; // barcode.description || barcode.code, or the caller-supplied "General" label
  points: PricePoint[]; // ascending by createdAt
}

/**
 * Groups a product's full purchase history (active + consumed batches,
 * already merged by the caller — see usePriceHistory.ts) into one series
 * per barcode ("sub-product"), plus a "General" series for legacy/
 * no-barcode batches. Batches with no recorded price contribute no point
 * (specs/Price History.md: never invented, never shown as zero) — a
 * series that ends up with zero points is omitted entirely, since
 * there's nothing to chart or toggle.
 *
 * `generalLabel` is passed in by the caller (which has useT()) rather
 * than looked up here — this module stays free of React/i18n, same
 * division of responsibility apps/web/src/lib/inventory.ts's
 * enrichProduct uses for its own i18n-dependent strings.
 */
export function buildPriceHistorySeries(batches: Batch[], barcodes: Barcode[], generalLabel: string): PriceSeries[] {
  const barcodeById = new Map(barcodes.map((b) => [b.id, b]));
  const byKey = new Map<string, PriceSeries>();

  for (const batch of batches) {
    if (batch.price === null) continue;
    const key = batch.barcode_id ?? GENERAL_SERIES_KEY;
    if (!byKey.has(key)) {
      const barcode = batch.barcode_id ? barcodeById.get(batch.barcode_id) : undefined;
      const label = batch.barcode_id ? barcode?.description || barcode?.code || batch.barcode_id : generalLabel;
      byKey.set(key, { key, label, points: [] });
    }
    byKey.get(key)!.points.push({ batchId: batch.id, createdAt: batch.created_at, price: batch.price });
  }

  for (const series of byKey.values()) {
    series.points.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return [...byKey.values()];
}

export interface VisibleStats {
  min: number;
  max: number;
  avg: number;
}

/**
 * Pools every point from every currently-visible series into one flat
 * min/avg/max — specs/Price History.md's reference line and top stat row
 * are both this same single, visible-set-aware number, not a per-series
 * average. Null when nothing is visible or there's no priced data at all.
 */
export function computeVisibleStats(series: PriceSeries[], visibleKeys: ReadonlySet<string>): VisibleStats | null {
  const prices = series.filter((s) => visibleKeys.has(s.key)).flatMap((s) => s.points.map((p) => p.price));
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  return { min, max, avg };
}
