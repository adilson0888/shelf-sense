import type { FreshnessStatus } from "../types";

/**
 * Stand-in for the not-yet-built user preferences feature (see
 * Product List.md's Non-functional section: "defaulting to a global user
 * preference ... when not explicitly set"). Product.freshness_threshold_days
 * overrides this per product.
 */
export const DEFAULT_FRESHNESS_THRESHOLD_DAYS = 7;

/** Whole days between `today` and a date-only ISO string, ignoring time-of-day. */
export function daysUntil(dateISO: string, today: Date): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function freshnessStatus(
  expiresOn: string | null,
  thresholdDays: number | null,
  today: Date,
): FreshnessStatus {
  if (!expiresOn) return "no-expiration";
  const d = daysUntil(expiresOn, today);
  if (d < 0) return "expired";
  if (d <= (thresholdDays ?? DEFAULT_FRESHNESS_THRESHOLD_DAYS)) return "expiring-soon";
  return "fresh";
}

export function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Human-friendly expiry label. The "speak in relative days" vs. "state the
 * date" cutoff is tied to the same threshold driving the freshness status,
 * so copy and badge color never disagree (a batch reading "fresh" never
 * says "Expires in N days", which would read as urgent regardless of color).
 */
export function formatExpiryLabel(expiresOn: string | null, thresholdDays: number | null, today: Date): string {
  if (!expiresOn) return "Does not expire";
  const d = daysUntil(expiresOn, today);
  if (d < -1) return `Expired ${Math.abs(d)} days ago`;
  if (d === -1) return "Expired yesterday";
  if (d === 0) return "Expires today";
  if (d === 1) return "Expires tomorrow";
  if (d <= (thresholdDays ?? DEFAULT_FRESHNESS_THRESHOLD_DAYS)) return `Expires in ${d} days`;
  return `Best before ${formatDate(expiresOn)}`;
}
