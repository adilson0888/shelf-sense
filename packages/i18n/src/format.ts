import type { Locale } from "./locale.js";

/**
 * Locale-aware date formatting via Intl.DateTimeFormat — specs/i18n.md's
 * Non-functional section explicitly calls for this over hand-rolled format
 * strings (08/20/2026 in en-US vs 20/08/2026 in pt-BR). `dateISO` is a
 * date-only ISO string ("YYYY-MM-DD"); parsed as local-time components
 * (not `new Date(dateISO)`, which parses as UTC midnight and can shift a
 * day depending on the viewer's timezone) — same parsing convention
 * apps/web/src/lib/freshness.ts's daysUntil() already uses.
 */
export function formatDate(dateISO: string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale, options ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** Locale-aware number formatting (thousands separators, decimal marks) via Intl.NumberFormat. */
export function formatNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(n);
}

/**
 * Joins short parallel fragments (e.g. "2 batches added", "1 batch
 * removed") into one locale-correct sentence via Intl.ListFormat.
 * `type: "unit"` (not the default "conjunction") keeps en-US's existing
 * plain comma-joined shape with no "and" — but this is genuinely
 * locale-dependent, not a universal rule this function enforces: pt-BR's
 * own CLDR data still inserts "e" for `type: "unit"` (confirmed directly,
 * not assumed — Portuguese "unit" lists read as "2 lotes adicionados e 1
 * lote removido"). That's correct, more natural Portuguese, not a bug to
 * fight — Intl.ListFormat is exactly what buys us that per-locale
 * correctness for free instead of hand-rolling a join. Not suitable for
 * full independent clauses (see productEdit.ts's saveSummary(), which
 * joins with "; " directly instead — Intl.ListFormat is built for
 * parallel nouns/units, not semicolon-separated sentences).
 */
export function formatList(items: string[], locale: Locale, options?: Intl.ListFormatOptions): string {
  return new Intl.ListFormat(locale, options ?? { type: "unit" }).format(items);
}
