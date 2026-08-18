import type { Formatter } from "./formatter.js";
import type { FreshnessStatus } from "./types.js";

/** Whole days between `today` and a date-only ISO string, ignoring time-of-day. */
export function daysUntil(dateISO: string, today: Date): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

// defaultThresholdDays is specs/Settings.md's default_freshness_threshold_days
// preference (read live via usePreferencesStore, not frozen at call time) —
// thresholdDays is Product.freshness_threshold_days, which wins when set.
// Returns a status enum, not user-facing text — no i18n involved here.
export function freshnessStatus(
  expiresOn: string | null,
  thresholdDays: number | null,
  defaultThresholdDays: number,
  today: Date,
): FreshnessStatus {
  if (!expiresOn) return "no-expiration";
  const d = daysUntil(expiresOn, today);
  if (d < 0) return "expired";
  if (d <= (thresholdDays ?? defaultThresholdDays)) return "expiring-soon";
  return "fresh";
}

/**
 * shelf-sense-ds's FreshnessBadge has no locale awareness of its own
 * (specs/i18n.md) — every consumer passes this explicitly translated
 * label instead of relying on the component's hardcoded English default.
 */
export function freshnessBadgeLabel(status: FreshnessStatus, t: Formatter["t"]): string {
  switch (status) {
    case "expired":
      return t("freshnessStatus.expired");
    case "expiring-soon":
      return t("freshnessStatus.expiringSoon");
    case "fresh":
      return t("freshnessStatus.fresh");
    case "no-expiration":
      return t("freshnessStatus.noExpiration");
  }
}

/**
 * Human-friendly expiry label. The "speak in relative days" vs. "state the
 * date" cutoff is tied to the same threshold driving the freshness status,
 * so copy and badge color never disagree (a batch reading "fresh" never
 * says "Expires in N days", which would read as urgent regardless of color).
 *
 * `i18n` is the bag useT() returns (or the relevant slice of it) — kept as
 * one params object rather than more positional args, since this function
 * already has four of those. Locale-aware date formatting for the
 * "Best before {date}" fallback comes from `i18n.formatDate`, not a
 * hardcoded toLocaleDateString("en-US", ...) — that was the one ad-hoc
 * Intl call site in this app before specs/i18n.md.
 */
export function formatExpiryLabel(
  expiresOn: string | null,
  thresholdDays: number | null,
  defaultThresholdDays: number,
  today: Date,
  i18n: Pick<Formatter, "t" | "tPlural" | "formatDate">,
): string {
  const { t, tPlural, formatDate } = i18n;
  if (!expiresOn) return t("freshness.doesNotExpire");
  const d = daysUntil(expiresOn, today);
  if (d < -1) return t("freshness.expiredDaysAgo", { days: Math.abs(d) });
  if (d === -1) return t("freshness.expiredYesterday");
  if (d === 0) return t("freshness.expiresToday");
  if (d === 1) return t("freshness.expiresTomorrow");
  if (d <= (thresholdDays ?? defaultThresholdDays)) return tPlural("freshness.expiresInDays", d);
  return t("freshness.bestBefore", { date: formatDate(expiresOn) });
}
