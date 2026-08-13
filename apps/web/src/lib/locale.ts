import { detectBrowserLocale, type Locale } from "shelf-sense-i18n";

/**
 * Browser-side locale bits — mirrors theme.ts's STORAGE_KEY/apply*() shape,
 * but with one real divergence: locale's actual source of truth is server-
 * side (preferences.language, via usePreferencesStore — see
 * AppLocaleProvider.tsx), not this localStorage cache. The cache here only
 * exists so the very next page load can paint in the right language
 * immediately, before the async GET /preferences resolves — once it does,
 * AppLocaleProvider reconciles to the server value (when
 * has_saved_preferences is true) and updates this cache to match.
 */
const LOCALE_STORAGE_KEY = "ss-locale";

export function getInitialLocale(): Locale {
  const cached = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (cached === "en-US" || cached === "pt-BR") return cached;
  return detectBrowserLocale(navigator.language);
}

export function persistLocale(locale: Locale) {
  document.documentElement.lang = locale;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
