/**
 * Hermes on Android ships partial Intl support: Intl.NumberFormat and
 * Intl.DateTimeFormat are built in, but Intl.Locale, Intl.PluralRules and
 * Intl.ListFormat (all used directly or transitively by shelf-sense-i18n)
 * are not — referencing them throws "undefined cannot be used as a
 * constructor" at runtime. Intl.Locale polyfills first since the
 * ListFormat locale-data loader constructs `new Intl.Locale(...)`.
 *
 * Each `should-polyfill` check is a no-op where the engine already has
 * native support (iOS, Jest/Node), so this file is safe to import
 * unconditionally as the app's first import.
 */
import { shouldPolyfill as shouldPolyfillLocale } from "@formatjs/intl-locale/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillPluralRules } from "@formatjs/intl-pluralrules/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillListFormat } from "@formatjs/intl-listformat/should-polyfill.js";

if (shouldPolyfillLocale()) {
  require("@formatjs/intl-locale/polyfill-force.js");
}

// Metro's static dependency graph requires require() targets to be string
// literals, so locale-data imports below can't be built from a loop/template.
if (shouldPolyfillPluralRules()) {
  require("@formatjs/intl-pluralrules/polyfill-force.js");
  require("@formatjs/intl-pluralrules/locale-data/en.js");
  require("@formatjs/intl-pluralrules/locale-data/pt.js");
}

if (shouldPolyfillListFormat()) {
  require("@formatjs/intl-listformat/polyfill-force.js");
  require("@formatjs/intl-listformat/locale-data/en.js");
  require("@formatjs/intl-listformat/locale-data/pt.js");
}
