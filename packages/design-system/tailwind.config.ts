import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "tailwindcss";
import { shelfSensePreset } from "./tailwind.preset";

// Resolved against this file's own location, not process.cwd() — Tailwind's
// default content-path resolution is CWD-relative, which silently produced
// near-empty utility CSS (only :root tokens/fonts, zero .rounded-full etc.)
// whenever something built from outside packages/design-system, e.g. a
// storybook build invoked from the monorepo root (see design-sync's NOTES.md
// "Storybook CSS was CWD-dependent" entry — this bit a full reference-storybook
// rebuild silently, with no build error, because unmatched content globs
// aren't treated as a Tailwind error).
const here = dirname(fileURLToPath(import.meta.url));

export default {
  presets: [shelfSensePreset],
  content: [join(here, "src/**/*.{ts,tsx}"), join(here, ".storybook/**/*.{ts,tsx}")],
} satisfies Config;
