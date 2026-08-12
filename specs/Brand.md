# Brand

Durable local record of ShelfSense's visual identity, sourced from the approved `templates/brand-guidelines/BrandGuidelines.dc.html` ("Brand guidelines · v1.0 · August 2026") in the `shelf-sense-ds` Claude Design project. Not a feature spec — doesn't go through the `draft → ready → done` loop in `specs/README.md`; update it in place whenever the brand guidelines change.

## Wordmark

Lowercase `shelf·sense`, set in **IBM Plex Mono** (never Inter, never title-cased as "ShelfSense"). The separator is a filled dot in `brand-600` — the same visual language as `StatusBadge`'s status dot, at logo scale. Clear space on all four sides equals the height of the letter "s". Minimum reproduction width: 120px on screen, 32mm in print — below that, use the icon alone, not a shrunk wordmark.

Never: recolor the dot, add a shadow/outline/gradient.

Canonical file: `brand/wordmark-c-ledger.svg` (one of three explored options — this is the one the guidelines pin down as correct; the `-a-stack`/`-b-rack` variants in the Claude Design project are earlier exploration, not in use).

## Icon — two valid marks

- **Ledger** (default) — `brand/icon-tile.svg` / `icon-mono.svg`, favicon `brand/favicon.ico`. Three ledger rows with the separator dot in the gap, echoing the wordmark's own construction. Use for the product UI, favicon, app stores, documentation, and anything "signed by the company."
- **Tote** (alternative) — `brand/icon-tote-tile.svg` / `icon-tote-mono.svg`, favicon `brand/favicon-tote.ico`. The mascot cropped to the tile. Use for consumer-facing placements, notifications, onboarding, merchandise, social avatars. **Never** as the main product's favicon.

Both are correct; never mix them within one surface.

## Mascot — Tote

A stock crate with a face and two handles — the only illustrated character in the system. Canonical design: `brand/mascot-a-crate.svg` (chosen among three explored options — the `-b-scout`/`-c-pip` variants aren't in use). Tote never speaks in first person, never holds props, never appears alongside a second character.

The lid recolors using the four stock-status tokens (`stock-in`/`stock-low`/`stock-out`/`stock-incoming`) — nothing else about Tote changes per status.

- **Do**: empty states, first-run screens, error/success illustrations, the Tote app icon, a slow two-frame blink for loading.
- **Don't**: place inside data tables/dashboards, add limbs/accessories/speech bubbles, redraw the face or change eye spacing, use below 24px (the icon exists for that).

## Color & type

Every value below is an existing `--ss-*` token in `packages/design-system/src/styles/tokens.css` — spot-checked against that file while writing this, not just taken on the guidelines' own word:

| Token | Hex (light) |
|---|---|
| `brand-50` | `#eefbfa` |
| `brand-200` | `#a8e8e3` |
| `brand-500` | `#219c93` |
| `brand-600` | `#167d76` |
| `ink-primary` | `#14181b` |
| `stock-in` | `#157f4a` |
| `stock-low` | `#a15c00` |
| `stock-out` | `#b3261e` |
| `stock-incoming` | `#3452b4` |

Brand teal (`brand-*`) identifies ShelfSense; the four status colors are vocabulary, not decoration — never repurpose them for branding.

**Type**: Inter for interface/editorial text (800 display, 700 headings, 600 labels, 400 body). IBM Plex Mono is the brand voice — wordmark, SKUs, counts, timestamps, uppercase eyebrow labels with 2px tracking. Both already wired into `packages/design-system/src/styles/fonts.css` (`@fontsource/inter`, `@fontsource/ibm-plex-mono`) — no new font work needed to use either.

## Where assets live

Pulled into this repo at `apps/web/public/brand/` as needed by features that use them — `favicon.ico`, `icon-tote-tile.svg`, and `icon-tote-mono.svg` were pulled in for `specs/Menu.md` (the drawer header uses Tote, not the Ledger default, and swaps tile/mono by theme — see that spec for why). The full source — including both icon families, all explored-but-unused wordmark/mascot variants, and mono/tote favicon variants — stays in the Claude Design project's `brand/` folder; pull in additional files as a feature actually needs them rather than vendoring everything preemptively.

**`lockup-ledger.svg` was pulled in, then removed** — it bakes the "shelf" text in as a fixed dark fill meant for the white background it's shown on throughout the guidelines document itself (see the wordmark section's own cover treatment). It's correct for a light/white surface (e.g. a printed page, a share card) but unreadable on `Menu`'s dark drawer, so that feature rebuilds the wordmark from real text on theme tokens instead of embedding this asset. Worth knowing before reaching for it again: it's not theme-safe as-is.

**Tile vs. mono is not a light/dark pair in this document as written** — the tile is captioned as staying "as-is" across surfaces, and mono is captioned for single-colour print, not for a web theme toggle. Worth flagging if this document gets revised: `icon-tote-mono.svg`'s face details are solid white with no backing tile, which is illegible on a light/white surface — if mono is ever pointed at a light background elsewhere, that's the same failure `Menu.md` found and worked around, not a new one.

## Not covered here

This document is purely visual identity (wordmark, icon, mascot, color, type). The source guidelines don't include trademark/legal usage guidance (registration status, ™/® usage, third-party usage rules) despite that coming up alongside "brand guidelines" — if that's actually needed, it doesn't exist yet and would need to be produced separately.
