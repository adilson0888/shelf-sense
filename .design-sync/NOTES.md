# design-sync notes — shelf-sense-ds

First sync: 2026-08-10. 9/9 components graded `match`, no skips, no `close` verdicts, no `[GENERAL]` issues.

## Repo-specific setup

- **Monorepo since 2026-08-10**: `shelf-sense-ds` source lives at `packages/design-system/`, not repo root. `.design-sync/`, `.ds-sync/`, and `ds-bundle/` stay at the **repo root** regardless — this is the skill's documented monorepo rule (`.design-sync/` always resolves from repo root). `config.json`'s `storybookConfigDir` is `packages/design-system/.storybook` and `buildCmd` is `npm run build -w shelf-sense-ds`.
- **This is the DS's own source repo** (not a consumer with `node_modules/shelf-sense-ds` installed), so every `package-build.mjs` / `resync.mjs` invocation run from repo root needs both `--node-modules ./node_modules --entry ./packages/design-system/dist/shelf-sense-ds.es.js`. `node_modules` is still at repo root — npm workspaces hoist it there. Run `npm run build -w shelf-sense-ds` first — the converter bundles `dist/`, not `src/`.
- **Reference storybook MUST be built with CWD = `packages/design-system`** — `cd packages/design-system && npx storybook build -o "$(git rev-parse --show-toplevel)/.design-sync/sb-reference"`. Do **not** run it from the repo root with `-c packages/design-system/.storybook` (see "CSS was silently empty" below — that invocation builds without error but ships near-zero Tailwind CSS). Also **not** `npm run build-storybook` (wrong output dir, `storybook-static/` inside the package).
- `cfg.provider` is intentionally unset: no components read React context, nothing to wrap.

## CSS was silently empty when the storybook build ran from repo root — fixed 2026-08-12

Discovered while re-syncing for the new `Switch` component: its storybook-reference render showed completely unstyled plain text (no pill, no color, no border-radius), and spot-checking the canary set (Button, Input, Modal, Select, StatusBadge — all previously graded `match`) showed the **exact same breakage** — so this was never Switch-specific, it's global. Root cause: `npx storybook build -c packages/design-system/.storybook -o ...` run with the process's CWD at the repo root builds successfully (exit 0, no warnings) but PostCSS/Tailwind never runs — only literal CSS (the `:root` custom properties and `@font-face` rules in `globals.css`) survives; the `@tailwind utilities;` directive produces nothing, since unrecognized at-rules are just dropped by the CSS minifier rather than erroring. `preview-*.css` came out ~9-16KB instead of the ~400KB the package's own `dist/style.css` build produces. Confirmed by building the identical config with CWD = `packages/design-system` instead: full CSS, `.rounded-full` and other utilities present.

Two fixes landed together:
1. **Always build the reference with CWD inside `packages/design-system`** (see the corrected command above) — this is the actual, verified fix.
2. **Defense in depth**: `packages/design-system/tailwind.config.ts`'s `content` globs now resolve via `import.meta.url`/`dirname` instead of relative strings, so they're correct regardless of CWD. This didn't fix the storybook build on its own (PostCSS wasn't even being invoked, so the file's content never mattered), but it's a real robustness fix for any other consumer (CI, a different engineer) that might build from an unexpected directory.

**Unresolved concern, not yet audited**: the monorepo restructure commit (`dca69be`, 2026-08-10) moved the DS source to `packages/design-system/`, and the `Sync Modal to Claude Design` commit (`cda662f`) happened *after* that move. If that sync's reference storybook was built with the (buggy) repo-root invocation, Modal may have been graded against an unstyled reference and still show as `match` in the anchor without ever having been correctly visually verified. Worth a deliberate re-grade of Modal (`compare.mjs --components Modal --spot-check-components Modal`) next time it's touched, to confirm it actually renders correctly rather than relying on the carried-forward grade.

## Fonts — was `[FONT_MISSING]`, now fixed at the source

Original build warned `[FONT_MISSING]` for Inter/IBM Plex Mono — the tokens named them but no `@font-face` shipped. Fixed properly (not worked around in config): added `@fontsource/inter` and `@fontsource/ibm-plex-mono` as devDependencies and authored `src/styles/fonts.css` with `@font-face` rules scoped to **latin + latin-ext only** (weights 400/500/600/700 for Inter, 400/500 for IBM Plex Mono), imported from `globals.css`. Vite resolves the bare `@fontsource/...` specifiers in `url()` and inlines the woff2s as base64 — `dist/style.css` is self-contained (409 KB).

**Re-sync risk**: if `@fontsource/inter` / `@fontsource/ibm-plex-mono` are ever removed from `package.json` devDependencies, the build will silently fall back to `[FONT_MISSING]` again (the CSS `@font-face` rules would 404 their `url()`s at Vite build time — check for that error specifically, it looks different from the validator warning). Don't reach for `cfg.extraFonts` here — the fix belongs in the library's own CSS, and it already ships correctly.
Originally imported the fontsource weight CSS files wholesale (`@fontsource/inter/400.css` etc.), which pulled in cyrillic/greek/vietnamese subsets nobody needs and bloated `dist/style.css` to 1.46 MB. Scoped to latin+latin-ext via a hand-authored `fonts.css` instead — 409 KB. If more locale coverage is ever needed, extend `fonts.css` deliberately rather than reverting to the wholesale import.

## Story cap

`Button` has 7 stories (`Primary/Secondary/Outline/Danger/Loading/AllVariants/Sizes`) — one over `compare.mjs`'s default cap of 6. Solo-phase grading used `--max-stories 7` to capture and grade all of them individually (not sibling-trusted) — this is recorded as an actual per-story grade in `Button.grade.json`, so it carries forward normally. If Button gains an 8th story, re-run with `--max-stories 8` (or higher) to grade the new one; the cap only affects capture, not already-graded stories.

## 2026-08-12 re-sync — Button's new `confirm` variant

Product Edit.md's confirm-to-commit Save button landed as a new `Button`
`variant="confirm"` (warning-amber, distinct from `primary`/`danger`) —
8th Button story added (`Confirm`), grade cleared and re-earned (all 8
`match`, captured with `--max-stories 8`). Canary spot-check on 5 more
components (reference-drift trigger, from the CSS-bug rebuild below) all
confirmed still `match`, nothing rewritten.

## Re-sync risks

- **Font resolution** (above) — the one thing that can silently regress if devDependencies drift.
- **Reference storybook CWD** (above) — building it from the wrong directory produces no error, just a near-empty stylesheet. Always verify a freshly-built `.design-sync/sb-reference/assets/preview-*.css` is hundreds of KB, not ~10-20KB, before trusting any grade against it.
- `.ds-sync/`, `.design-sync/sb-reference/`, `.design-sync/.cache/`, and the playwright chromium install are all gitignored/local — a fresh clone needs: re-stage scripts (`cp -r` from the skill's `design-sync/` dir into `.ds-sync/`), `npm i` in `.ds-sync/` + `npx playwright install chromium`, rebuild `.design-sync/sb-reference`, then run the driver.
- This environment's playwright chromium install used a fallback build (`ubuntu24.04-x64` unsupported officially) — if captures start failing on a different machine, chromium may need `npx playwright install-deps chromium` or `DS_CHROMIUM_PATH`.
- Nothing was skipped, no `close` verdicts, no overrides/forks — a completely clean first sync. Any future warning in `package-validate.mjs` is genuinely new; there's no accepted-warnings list to check against yet.
