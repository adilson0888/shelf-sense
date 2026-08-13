#!/usr/bin/env node
// Build-time fallback resolution — see specs/i18n.md's tension between
// "only load the active locale's file, not both" and "a missing pt-BR key
// falls back to en-US." Runtime fallback would need both dictionaries
// loaded to work; this script resolves it once, at build time, instead:
// pt-BR.json is allowed to be sparse in src/ (new keys land in English
// first per AC6), but the *shipped* dist/locales/pt-BR.js is always fully
// self-contained (English fills any gap), so loadLocale() only ever needs
// to load one file at runtime.
//
// Ships as dist/locales/*.js (`export default {...}`), not raw *.json —
// see dictionary.ts's loadLocale() for why: a dynamic JSON import needs an
// explicit import attribute under plain Node, which Vite's dev server
// then mishandled for a pre-built dependency file. Plain JS sidesteps
// that across every environment this package runs in.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "src", "locales");
const distDir = join(root, "dist", "locales");

const enUS = JSON.parse(readFileSync(join(srcDir, "en-US.json"), "utf8"));
const ptBR = JSON.parse(readFileSync(join(srcDir, "pt-BR.json"), "utf8"));

const merged = { ...enUS, ...ptBR };

const missingFromPtBR = Object.keys(enUS).filter((key) => !(key in ptBR));
if (missingFromPtBR.length > 0) {
  console.warn(
    `[shelf-sense-i18n] ${missingFromPtBR.length} key(s) missing from pt-BR.json, filled with English:\n` +
      missingFromPtBR.map((k) => `  - ${k}`).join("\n"),
  );
}

function writeModule(fileName, dict) {
  writeFileSync(join(distDir, fileName), `export default ${JSON.stringify(dict, null, 2)};\n`);
}

mkdirSync(distDir, { recursive: true });
writeModule("en-US.js", enUS);
writeModule("pt-BR.js", merged);
