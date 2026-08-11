import type { Config } from "tailwindcss";
// Relative, not "shelf-sense-ds/tailwind.preset" — that subpath isn't in the
// package's exports map (deliberately: it's monorepo-internal tooling
// config, not part of the published package's public API).
import { shelfSensePreset } from "../../packages/design-system/tailwind.preset";

export default {
  presets: [shelfSensePreset],
  // shelf-sense-ds/styles.css ships already-compiled CSS (only classes used
  // inside packages/design-system's own source) — this app's own JSX needs
  // its own scan, or any class not already used by a component (arbitrary
  // values, one-off layout classes) silently resolves to nothing.
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
} satisfies Config;
