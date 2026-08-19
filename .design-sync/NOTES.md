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

## 2026-08-12 re-sync — IconButton/NavDrawer not yet in scope (no stories)

`Add IconButton and NavDrawer to shelf-sense-ds` (commit `a9b8d3e`) landed
two new components, but neither has a `.stories.tsx` file, so the storybook
shape's discovery (which walks `storybook-static`'s index, not the source
tree) doesn't see them — the driver correctly reported 12/12 components,
unchanged, with no `[ZERO_MATCH]` or other warning, because from its
perspective nothing storied changed. **They will not appear in the Claude
Design project until they get stories.** Next time either component is
touched (or before the Menu feature that consumes them is designed against
the synced project), add `IconButton.stories.tsx` / `NavDrawer.stories.tsx`
and re-run the driver — NavDrawer will need `cfg.overrides.NavDrawer.cardMode:
"single"` (or `"column"`) since it's an overlay/portal component like Modal.

## 2026-08-12 re-sync — conventions.md drift found and fixed

Validation pass (required whenever `conventions.md` already exists) found
`bg-surface-3` documented as a standalone utility class that doesn't
actually ship: Tailwind's JIT only emits classes literally present in
scanned source, and the only real usage is `hover:bg-surface-3` /
`active:bg-surface-3` in `Button.tsx`'s secondary variant — no component
uses bare `bg-surface-3`, so it's purged. This predates today's IconButton/
NavDrawer change (Button.tsx wasn't touched) — it slipped through the
original authoring pass. Fixed the line to document the real
`hover:`/`active:` variants instead of the nonexistent bare class. Rebuilt
via the driver so the uploaded README carries the corrected header.

## 2026-08-12 re-sync — IconButton/NavDrawer synced (12 → 14 components)

Added `IconButton.stories.tsx` / `NavDrawer.stories.tsx` (neither existed — see the prior NOTES.md entry) and ran the full re-sync. `NavDrawer` got `cfg.overrides.NavDrawer.cardMode: "single"` / `primaryStory: "Open"` per the prior entry's own recommendation (overlay/portal component, same treatment as `Modal`).

**[GENERAL] A story that renders only `<NavDrawer>` alone leaves `#storybook-root` empty and fails capture with "no storybook root content".** `NavDrawer`'s whole visible output is a `createPortal(..., document.body)` call — nothing is left in the component's own place in the tree, so a story with no OTHER sibling content renders zero DOM nodes into root and the capture harness times out waiting for it (`compare.mjs`'s `SB_CONTENT` selector, `../non-storybook` and storybook §3's `[SB_*]` rows don't cover this one — it's specific to portal components with no page content of their own). `Modal`'s stories never hit this because they always render a trigger `<Button>` alongside the modal. Fix: any story for a portal-only component must render a real, non-portaled sibling element (a trigger button, a labeled background block) even when the story wants the overlay open by default — an `sr-only` element is not required, just *something* under `#storybook-root`/`#root`. Applies to any future portal component with an "open by default" story, not just NavDrawer.

**Reference-storybook CSS size heuristic needed updating.** The existing "verify hundreds of KB, not ~10-20KB" check (below) was calibrated against the CWD bug's specific symptom (zero Tailwind output). This rebuild's `preview-*.css` came out ~20KB — correct, not a regression: this storybook build ships the 12 font weights as separate hashed `.woff2` asset files (~3.4MB total in `assets/`) rather than inlining them as base64 into the CSS the way the package's own `dist/style.css` does, so the CSS-only byte count naturally reads much smaller for a reason unrelated to whether Tailwind actually ran. Verified by content, not just size, before trusting it: grepped the built CSS for classes real components use (`rounded-full`, `bg-info-bg`, `translate-x-full`, `pointer-events-none`, etc.) and all resolved. **Updated check**: confirm real utility classes are present in the CSS content (or the total `assets/` directory is multi-MB, fonts included) — a bare KB-count on the CSS file alone is no longer a reliable signal by itself now that fonts split out as separate files.

Grading: `IconButton` graded exhaustively (5/5 `match`, all image-judged — solo-phase representative for this run, no sibling-trusted entries). `NavDrawer` graded exhaustively (3/3 `match`, all image-judged — portal component, per §4's rule to always grade these in full). Canary spot-check on 5 carried-forward components (`Modal`, `Input`, `Card`, `StatCard`, `Switch` — reference-storybook rebuild triggered `reference_drift`) confirmed all still match their recorded grades, nothing re-graded.

`conventions.md` validated against the fresh build (existing file, so re-validated rather than rewritten per the skill's rule) — every class/token it names still resolves in the compiled CSS. No drift found, file unchanged. Not extended to specifically call out `IconButton`/`NavDrawer` — neither needs new provider/styling-idiom guidance beyond what's already documented, and the file's own "read the `.prompt.md` before using a component you haven't used yet" line already covers them.

## 2026-08-19 re-sync — Footer/Popover synced (14 → 16 components), chart token palette added

Two components already had stories but hadn't been synced yet — `Footer` and `Popover` — both graded exhaustively (1/1 and 1/1 `match`). `Popover`'s one story (`Row Actions Menu`) renders closed by default (`useState(false)`, no forced-open variant), so both the storybook reference and our preview correctly show just the "⋯" trigger with no open menu — a legitimate match, not the NavDrawer-style portal-capture issue (that one was about a story leaving `#storybook-root` empty; this story's own visible trigger button is real page content either way).

Canary spot-check on 5 carried-forward components (`Modal`, `IconButton`, `Badge`, `Select`, `StatusBadge`, triggered by `reference_drift` from the `tokens.css`/`sb-reference` rebuild below) confirmed all still match their recorded grades — expected, since the token change only *added* new unused custom properties, never touched an existing value.

**New: `--ss-chart-1` through `--ss-chart-6`** categorical palette added to `tokens.css` (light + dark), for `specs/Price History.md`'s multi-line chart — first chart-bearing feature in the app. Documented in `packages/design-system/README.md`'s new "Charts" section (library: `recharts`, added at the `apps/web` level, not this package). These are raw CSS custom properties, not exposed as Tailwind utility classes (no `bg-chart-1` etc.) — a chart consumes them directly via `var(--ss-chart-N)` in `stroke`/`fill`, the same way `recharts` props take raw CSS values. **Not yet added to `.design-sync/conventions.md`** (the design agent's own build reference) — deliberately left as a proposal rather than self-authored, since the skill's rule is validate-and-propose, not extend, on an existing conventions file. Worth adding a short line next time this project is touched, once there's a real chart component to point at as the idiomatic example.

**Own bug, caught before it shipped**: the tokens.css comment introducing the chart palette originally contained a literal `--ss-stock-*/--ss-freshness-*`, whose `*/` prematurely closed the CSS block comment — `npm run build -w shelf-sense-ds` still exited 0, but esbuild's CSS minifier warned `Expected ":" [css-syntax-error]` on the now-uncommented prose. Fixed by spacing the slash out (`--ss-stock-* / --ss-freshness-*`). Worth remembering for any future token comment: never write a literal `*/` inside a CSS `/* */` comment, even mid-sentence.

**`conventions.md` drift found and fixed** (same category as the 2026-08-12 `bg-surface-3` entry below): the Generic-semantic row documented `bg-success`/`bg-info` as if both the bare and `-bg` forms ship. Verified against the fresh `dist/style.css`: only `bg-success-bg`/`bg-info-bg` and `text-success`/`text-info` actually ship — no component anywhere uses the bare solid `bg-success`/`bg-info` class, so Tailwind's JIT purges them (unlike `bg-danger`/`bg-warning`, which DO ship bare because `Button`'s `danger`/`confirm` variants use them directly). Fixed the table row to document reality; rebuilt via the driver so the uploaded README carries the corrected header.

Grading: `Footer`/`Popover` graded exhaustively (2/2 `match`, image-judged). 16/16 components now synced, no skips, no `close` verdicts. `_ds_needs_recompile` sentinel fenced both writes; final `list_files` confirmed all 16 component dirs, `_ds_bundle.js`/`.css`, `styles.css`, `README.md`, `_ds_sync.json` present.

## Re-sync risks

- **Font resolution** (above) — the one thing that can silently regress if devDependencies drift.
- **Reference storybook CWD** (above) — building it from the wrong directory produces no error, just a near-empty stylesheet. **Verify by content, not raw file size**: `preview-*.css` alone now legitimately runs ~20KB (fonts ship as separate hashed `.woff2` files under `assets/`, not inlined) — the old "hundreds of KB" heuristic was specific to the CWD bug's zero-Tailwind symptom. Grep the built CSS for a handful of real component classes (e.g. `rounded-full`, `bg-info-bg`) instead, or check that `assets/` totals multiple MB once fonts are counted.
- **Portal-only components need a non-portaled sibling in every story** (2026-08-12, `[GENERAL]`) — a story that renders just `<NavDrawer open .../>` (or any component whose entire output is `createPortal(...)`) leaves `#storybook-root` empty and fails capture with "no storybook root content", even though the component itself works fine. Always include a real visible element (trigger button, background block) alongside the portal component in the story's return value — applies to `Modal` too (already does this) and any future portal component.
- `.ds-sync/`, `.design-sync/sb-reference/`, `.design-sync/.cache/`, and the playwright chromium install are all gitignored/local — a fresh clone needs: re-stage scripts (`cp -r` from the skill's `design-sync/` dir into `.ds-sync/`), `npm i` in `.ds-sync/` + `npx playwright install chromium`, rebuild `.design-sync/sb-reference`, then run the driver.
- This environment's playwright chromium install used a fallback build (`ubuntu24.04-x64` unsupported officially) — if captures start failing on a different machine, chromium may need `npx playwright install-deps chromium` or `DS_CHROMIUM_PATH`.
- 14/14 components graded `match` as of 2026-08-12's IconButton/NavDrawer sync — no skips, no `close` verdicts, no unresolved overrides beyond `Modal`/`NavDrawer`'s documented `cardMode`. Any future warning in `package-validate.mjs` is genuinely new; there's no accepted-warnings list to check against yet.
