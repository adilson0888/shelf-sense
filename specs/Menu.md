# Menu

**Status:** ready — approved in Claude Design as `templates/nav-drawer/NavDrawer.dc.html`; implementing against that prototype.

## User story

As someone using ShelfSense mostly from my phone, I want a simple way to get to the app's different sections, so that I can navigate without permanent nav chrome competing with the content I actually came for.

## Acceptance criteria

- [ ] Given any page in the app, when viewing the top app bar, then a hamburger control is present and opens the navigation drawer.
- [ ] Given the drawer is closed, when the hamburger control is tapped, then the drawer opens showing the navigation items as a flat list.
- [ ] Given the drawer is open, when a navigation item is tapped, then the app navigates to that section and the drawer closes.
- [ ] Given the drawer is open, when the user taps outside the drawer or a dedicated close control, then the drawer closes without navigating.
- [ ] Given the drawer is open, when it renders, then the item matching the current section is visually marked as active.
- [ ] Given a new section is added later (e.g. Reports, Prices), when it's added to the drawer, then no structural change is needed beyond appending to the flat list.
- [ ] Given the drawer is open, when it renders, then a light/dark theme toggle is present, independent of the navigation item list.
- [ ] Given the user activates the theme toggle, when the change is applied, then the whole app's theme updates immediately, the drawer stays open, and the choice persists across sessions.

## Data

Not tied to a backend entity — this is internal nav config, not something `apps/api` serves.

```ts
interface MenuItem {
  key: string;
  label: string;
  route: string; // path this item navigates to
  icon: string; // a single text/emoji glyph, e.g. "▤" — see UI requirements
}
```

Items at launch, in order:

| key | label | route | icon |
|---|---|---|---|
| `inventory` | Inventory | `/` | ▤ |
| `products` | Products | `/products` | 🗂 |
| `grocery` | Grocery List | `/grocery` | 🛒 |
| `settings` | Settings | `/settings` | ⚙ |

`products` added 2026-08-13 by `specs/Product List.md` — a flat, filterable catalog of every product identity, distinct from `inventory`'s grouped/stock-triage view (which excludes zero-quantity products; `products` is one of the two places `Inventory.md`'s "Open gap" note points to for where those surface instead). Per this spec's own "no structural change needed beyond appending to the flat list" acceptance criterion, adding it doesn't change `Menu.md`'s mechanics — but the already-approved `NavDrawer` prototype hasn't seen a third item yet, so a design-sync pass is still owed before this ships.

`grocery` added 2026-08-15 by `specs/Grocery List.md` (draft) — the other half of `Inventory.md`'s "Open gap" note: a focused view of what's currently low or out of stock, derived entirely from data `Inventory.md`/`Relative Tracking.md` already track. Same "no structural change" mechanics as `products`'s addition above; same still-owed design-sync pass, now for a fourth item.

The theme toggle is not a `MenuItem` — it's not a navigable section, just a control that lives in the drawer alongside the item list (see UI requirements). Its state is a simple client-side preference (`"light" | "dark"`), not something `apps/api` needs to know about for this pass.

## UI requirements

Implemented against the approved Claude Design prototype (`templates/nav-drawer/NavDrawer.dc.html`, "Nav Drawer"). Superseded a couple of things this section used to say — differences called out below rather than silently absorbed, same convention as `Inventory.md`.

- **Top app bar**: sticky, `IconButton` hamburger trigger (☰, `aria-label="Open navigation"`) on the left, current screen title next to it. Present on every page.
- **Drawer**: overlay + scrim over the current page, sliding in from the left (`transform: translateX`, 288px wide / max 86vw). Dismissible by tapping the scrim, the drawer's own close (`✕`) `IconButton`, Escape, or picking an item.
- **Drawer header**: the real brand mark, not a hand-drawn placeholder — the Tote/mascot icon plus the "shelf·sense" wordmark, plus a "Personal inventory" tagline underneath. The prototype's own header used an ad hoc inline SVG in place of this; that predates the brand guidelines and didn't carry into implementation.
  - **Tote, not Ledger, by explicit choice.** `specs/Brand.md`'s guidelines default to the Ledger mark for "product UI," which this drawer arguably is — overridden deliberately for this feature rather than followed by default.
  - **Icon swaps `tile` ↔ `mono` by theme** — `icon-tote-tile.svg` (opaque teal square) in light theme, `icon-tote-mono.svg` (no background, floats on the surface) in dark theme. This is a rule this feature added, not one in the source guidelines — they document the tile as staying "as-is" across surfaces and mono as a print variant, not a light/dark pair. Picked this pairing specifically because the alternative (mono in light theme) puts mono's solid-white face details on a near-white background — invisible, the same class of bug the wordmark had (see below) — so tile-for-light/mono-for-dark is the one assignment that stays legible in both themes, not an arbitrary split.
  - **Not** `brand/lockup-ledger.svg` (the combined icon+wordmark asset) — that SVG bakes in a fixed dark hex fill for the "shelf" text, sized for the light/white background it's shown on in the guidelines' own cover page; on this drawer's dark surface it renders unreadable (confirmed visually while implementing). The wordmark is rebuilt from real text on `text-ink-primary`/`text-brand-600` tokens instead, so it stays theme-correct in both modes — same construction (IBM Plex Mono, lowercase, dot separator) without the contrast bug.
- **Flat list** of items — no grouping/categories, matching the small, short item count confirmed for this app.
- **Items today**: Inventory, Products, Settings (see Data; Inventory and Settings shipped at launch under the name "Products" — since renamed — Products added 2026-08-13) — each rendered as a full-width pill button with a leading icon glyph and label. **Icons resolved as plain text/emoji glyphs** (▤, 🗂, ⚙), not an icon library — this settles the icon-set question the previous draft left open as "TBD": the approved design uses no icon dependency at all, and there's no need to introduce one.
- **Active item**: filled pill using `--ss-info` / `--ss-info-bg` (background + text), matching the current route; inactive items are plain text, `--ss-surface-2` on hover.
- **Mobile-first**: the primary target is a phone-width browser viewport (this app is used mostly on a phone); wider viewports shouldn't break but aren't the design target for this pass.
- **Theme toggle**: lives in the drawer's footer, below the item list behind a divider — resolves the cross-reference from `Inventory.md` ("a theme switcher exists but lives in the main menu, not here"). **Built as a round `IconButton`** showing a sun/moon glyph (☀/☾) that flips the theme on click, **not** the `Switch` component — the previous draft assumed `Switch` would be reused here, but the approved design uses the same circular icon-button pattern as the hamburger/close controls instead, and that's what shipped.
- **Components — new in `shelf-sense-ds`**:
  - `IconButton` — circular icon-only button (used for the hamburger trigger, drawer close, and theme toggle); didn't exist before this feature.
  - `NavDrawer` — the overlay + sliding panel + item list, composed with `IconButton` internally.
  Built in `packages/design-system` against this approved prototype; sync back to Claude Design (`/design-sync`) is a separate, not-yet-run follow-up — see Non-functional.

## Non-functional

- **Routing**: `apps/web`'s `App.tsx` previously rendered `ProductListPage` directly with no router. Implementing Menu means introducing real routing (`react-router-dom`) — `/` → Inventory, `/settings` → Settings. (`/products` → Products added 2026-08-13, see `specs/Product List.md`.)
- **Accessibility**: hamburger/close/theme controls all carry `aria-label`s; the drawer panel is `role="dialog"` `aria-modal="true"`; closes on Escape. Full focus-trapping (cycling Tab within the open drawer) is **not** implemented — matches the existing `Modal` component's own level of a11y in this codebase (Escape + `aria-modal` only), not a new gap introduced by this feature.
- **Motion**: open/close transition should feel immediate on phone hardware — no perceptible lag between tapping the hamburger and the drawer responding.
- **Theme persistence**: the chosen theme is stored client-side (`localStorage`) and applied via an inline script in `index.html`'s `<head>`, before React hydrates, to avoid a flash of the wrong theme on load.
- **Design-sync not yet run**: `IconButton`/`NavDrawer` are built and used for real in `apps/web`, but haven't gone through `/design-sync`'s grading pipeline to sync back into the Claude Design project — that's a follow-up step, not part of this implementation pass.

## Out of scope

- **Bottom tab bar** — considered and explicitly rejected in favor of the drawer, since it scales to added sections without a later redesign.
- **Grouping/categorizing nav items** — flat list only for now; revisit if the item count grows enough to need it.
- **Additional sections** (Reports, Prices, others) — deferred, see `specs/BACKLOG.md`.
- **Desktop/back-office-oriented layout** (e.g. a persistent sidebar) — not needed; primary usage is phone-first, personal/domestic use, not a desktop admin surface.
- **Settings screen content** — Menu only needs Settings to exist as a navigable destination; what actually lives on that screen (language picker per `i18n.md`, etc.) is each owning spec's concern, not this one.
- **Full focus-trap inside the open drawer** — see Non-functional; not a pattern used elsewhere in this codebase yet.
