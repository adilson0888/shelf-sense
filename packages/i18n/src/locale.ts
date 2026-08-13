/**
 * Locale primitives — see specs/i18n.md. Locales at launch: en-US
 * (default/fallback) and pt-BR. No React/DOM coupling in this file (or
 * anywhere in this package's root entry point) — apps/web's own
 * lib/locale.ts owns the browser-specific bits (localStorage, document.
 * documentElement.lang); this stays reusable by a future non-web consumer.
 */
export type Locale = "en-US" | "pt-BR";

export const DEFAULT_LOCALE: Locale = "en-US";

export const SUPPORTED_LOCALES: Locale[] = ["en-US", "pt-BR"];

/**
 * specs/i18n.md's first-launch acceptance criteria, verbatim: "read the
 * device/browser locale, match it to pt-BR if exact, else fall back to
 * en-US." Deliberately an exact match only — a browser reporting "pt" or
 * "pt-PT" falls back to en-US, not a broader "starts with pt" heuristic.
 */
export function detectBrowserLocale(navigatorLanguage: string): Locale {
  return navigatorLanguage === "pt-BR" ? "pt-BR" : DEFAULT_LOCALE;
}
