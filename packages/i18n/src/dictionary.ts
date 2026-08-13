import type { Locale } from "./locale.js";

/** Flat, dot-namespaced key -> translated string map — one locale's worth. */
export type Dictionary = Record<string, string>;

/**
 * Loads exactly one locale's dictionary — never both at once (specs/i18n.md's
 * "only load the active locale's translation file at startup" bundle-cost
 * requirement). Written as a literal if/else (not a template-literal dynamic
 * import) so bundlers can statically analyze and code-split each branch.
 *
 * The imported files are `dist/locales/*.json`, not `src/locales/*.json` —
 * built by `scripts/merge-locales.mjs`, which merges pt-BR.json onto
 * en-US.json so every locale's *shipped* file is fully self-contained. That
 * merge is what makes a missing pt-BR key fall back to its en-US value
 * (AC5) without ever loading two dictionaries at runtime to do it — the
 * fallback is resolved at build time, not read time.
 */
export function loadLocale(locale: Locale): Promise<{ default: Dictionary }> {
  // dist/locales/*.js, not .json — written by scripts/merge-locales.mjs as
  // plain `export default {...}` modules. Confirmed the hard way: a raw
  // dynamic JSON import needs an explicit import attribute under plain
  // Node (ERR_IMPORT_ATTRIBUTE_MISSING without one), but Vite's *dev*
  // server (unlike its production Rollup build, which handled it fine)
  // mismatched the MIME type and failed to load the module when that
  // attribute was present on a pre-built dependency's file. A plain JS
  // module needs no import attribute in any of the three environments
  // this package runs in (Node, Vite dev, Vite/Rollup prod) — see
  // locale-modules.d.ts for the ambient type declaration this needs,
  // since dist/locales/*.js doesn't exist as real source for tsc to
  // resolve against.
  if (locale === "pt-BR") return import("./locales/pt-BR.js");
  return import("./locales/en-US.js");
}

/**
 * Looks up `key` in `dict`. Falls back to the raw key itself if truly
 * missing (post-merge, `dict` is already the fallback-resolved dictionary —
 * this only fires for a key that doesn't exist in en-US.json either, i.e.
 * a real bug) — visibly broken rather than blank, per AC5's spirit.
 */
export function t(dict: Dictionary, key: string, params?: Record<string, string | number>): string {
  const raw = dict[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Picks a `.one`/`.other`-suffixed key via Intl.PluralRules(locale) and
 * looks it up the same way `t()` does. English and Portuguese both use the
 * simple two-category cardinal system (no Slavic-style extra categories),
 * so `.one`/`.other` is the complete set for both launch locales. `count`
 * is available to interpolate via `{count}` even when not explicitly
 * passed in `params` — most callers want it.
 */
export function tPlural(
  dict: Dictionary,
  locale: Locale,
  keyBase: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const suffix = category === "one" ? "one" : "other";
  return t(dict, `${keyBase}.${suffix}`, { count, ...params });
}
