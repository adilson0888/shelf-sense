// The actual files these declare don't exist in src/ — they're written by
// scripts/merge-locales.mjs at build time, straight into dist/locales/.
// This ambient declaration is what lets dictionary.ts's loadLocale()
// type-check against them anyway. See loadLocale()'s own comment for why
// dist ships plain .js (`export default {...}`) rather than raw .json:
// Vite's dev server mishandles the import-attribute syntax a dynamic JSON
// import needs under plain Node — a plain JS module sidesteps that
// entirely and behaves identically in Node, Vite dev, and Vite/Rollup
// prod builds.
declare module "./locales/*.js" {
  const dict: Record<string, string>;
  export default dict;
}
