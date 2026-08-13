import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatDate, formatList, formatNumber, t, tPlural, type Dictionary, type Locale } from "./index.js";

/**
 * Thin React binding on top of this package's framework-agnostic core
 * (locale.ts/dictionary.ts/format.ts) — kept in its own entry point
 * ("shelf-sense-i18n/react") so pure lib modules (menu.ts, freshness.ts,
 * etc.) can call t()/tPlural() directly without pulling React into their
 * import graph at all. `react` is a peerDependency only — no react-dom or
 * document/window coupling here, so this half is reusable by a future
 * non-web (e.g. React Native) consumer even though none exists yet.
 */
interface I18nContextValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export interface TFunctions {
  t: (key: string, params?: Record<string, string | number>) => string;
  tPlural: (keyBase: string, count: number, params?: Record<string, string | number>) => string;
  formatDate: (dateISO: string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  formatList: (items: string[], options?: Intl.ListFormatOptions) => string;
  locale: Locale;
}

/** Every component with a hardcoded string calls this and swaps literals for t("namespace.key"). */
export function useT(): TFunctions {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within an I18nProvider");
  const { locale, dict } = ctx;
  return useMemo(
    () => ({
      t: (key: string, params?: Record<string, string | number>) => t(dict, key, params),
      tPlural: (keyBase: string, count: number, params?: Record<string, string | number>) =>
        tPlural(dict, locale, keyBase, count, params),
      formatDate: (dateISO: string, options?: Intl.DateTimeFormatOptions) => formatDate(dateISO, locale, options),
      formatNumber: (n: number, options?: Intl.NumberFormatOptions) => formatNumber(n, locale, options),
      formatList: (items: string[], options?: Intl.ListFormatOptions) => formatList(items, locale, options),
      locale,
    }),
    [dict, locale],
  );
}
