import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { I18nProvider } from "shelf-sense-i18n/react";
import { loadLocale, type Dictionary, type Locale } from "shelf-sense-i18n";
import { getInitialLocale, persistLocale } from "./locale";
import { usePreferencesStore } from "./preferencesStore";

/**
 * Wires the active locale into the app — see specs/i18n.md. Separate from
 * lib/locale.ts (which stays a plain, hook-free module) because this needs
 * JSX and usePreferencesStore(); needs to sit inside PreferencesProvider
 * but wrap everything else (see App.tsx).
 *
 * Reconciliation: `preferences.has_saved_preferences` (apps/api's
 * preferences.ts) is the only signal that distinguishes "nobody has ever
 * saved a preference" from "someone explicitly chose en-US" — both would
 * otherwise look identical in the GET response. Gating strictly on that
 * flag (not on `loading` alone) means a still-loading or network-failed
 * fetch never overrides the browser-detected/cached locale — see
 * preferencesStore.tsx's DEFAULT_PREFERENCES, which must keep this false.
 */
export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferencesStore();
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [dict, setDict] = useState<Dictionary | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLocale(locale).then(({ default: loaded }) => {
      if (!cancelled) setDict(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Before paint, not after — <html lang> should never be stale for a
  // rendered frame (an accessibility-timing concern, not a visual one, so
  // no inline pre-hydration <script> is needed here unlike theme.ts's).
  useLayoutEffect(() => {
    persistLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (preferences.has_saved_preferences && preferences.language !== locale) {
      setLocale(preferences.language);
    }
  }, [preferences.has_saved_preferences, preferences.language, locale]);

  // Blocks only on the local dictionary chunk resolving (near-instant,
  // same-bundle) — never on the network GET /preferences, which
  // ProductsProvider/PreferencesProvider already render optimistically
  // ahead of elsewhere in this app.
  if (!dict) return null;

  return (
    <I18nProvider locale={locale} dict={dict}>
      {children}
    </I18nProvider>
  );
}
