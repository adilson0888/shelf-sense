#!/usr/bin/env node
// Verification script (specs/i18n.md): confirms the post-merge dist/locales
// modules have identical key sets. A real gap here would mean loadLocale()
// could return `undefined` for a key that exists in the other locale —
// shouldn't be possible given merge-locales.mjs's logic, but this is the
// automated check that catches a regression in that logic itself.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { default: enUS } = await import(join(root, "dist", "locales", "en-US.js"));
const { default: ptBR } = await import(join(root, "dist", "locales", "pt-BR.js"));

const enKeys = new Set(Object.keys(enUS));
const ptKeys = new Set(Object.keys(ptBR));
const missingFromPt = [...enKeys].filter((k) => !ptKeys.has(k));
const missingFromEn = [...ptKeys].filter((k) => !enKeys.has(k));

if (missingFromPt.length > 0 || missingFromEn.length > 0) {
  console.error(`[shelf-sense-i18n] locale key parity check FAILED.`);
  if (missingFromPt.length > 0) console.error(`  Missing from pt-BR (post-merge): ${missingFromPt.join(", ")}`);
  if (missingFromEn.length > 0) console.error(`  Missing from en-US: ${missingFromEn.join(", ")}`);
  process.exit(1);
}

console.log(`[shelf-sense-i18n] locale key parity OK — ${enKeys.size} keys in both dist/locales/*.js.`);
