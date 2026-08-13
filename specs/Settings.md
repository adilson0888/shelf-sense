# Settings

**Status:** draft

## User story

As the app's user, I want a single place to configure AI provider access, my global inventory defaults, and my language, so that I don't have to set them per-product or re-discover them scattered across other screens.

## Acceptance criteria

- [ ] Given I'm in the App Menu, when I tap Settings, then the Settings page opens (per `specs/Menu.md`'s existing `/settings` route — the destination this spec fills in for real).
- [ ] Given the Settings page renders, when I view it, then its content is grouped into three categories, in this order: **AI Settings**, **Default Options**, **User Preferences** — each with a subtitle heading on top and a horizontal divider line below it (except the last category, which has no trailing divider), same visual language as `NavDrawer`'s existing footer divider (`border-t border-border`, see `packages/design-system/src/components/NavDrawer/NavDrawer.tsx` line 107).
- [ ] Given the AI Settings category, when I view it, then I can set an OpenAI-API-compatible **base URL**, **API key**, and **model name** — all three optional/independently settable, one active config (not a list).
- [ ] Given an API key was previously saved, when the page loads, then the key field never displays the real value — only a masked hint (e.g. `•••• wXyz`, last 4 characters) plus a way to clear the saved key outright, distinct from typing a new one.
- [ ] Given I type a new API key and save, when the save completes, then the new key replaces the old one and the field goes back to showing the new masked hint, never the raw value, on next load.
- [ ] Given I click "clear saved key" and save, when the save completes, then no key is stored (`ai_api_key_set: false`) and the AI Settings fields show no hint.
- [ ] Given the Default Options category, when I view it, then I can set a **default minimal quantity** (integer, ≥ 0), a **default freshness threshold in days** (integer, ≥ 0), and whether **products expire by default** (on/off) — all three always have a value (no blank/null state for these three, unlike their per-product counterparts).
- [ ] Given I lower a product's own `minimal_quantity`/`freshness_threshold_days` to a specific number (per `Product Add.md`/`Product Edit.md`), when Inventory/Stock Edit render that product, then the per-product value still wins — these global defaults only apply when a product's own value is `null`, exactly the existing fallback behavior, just reading a real configured value instead of a hardcoded constant.
- [ ] Given I change "products expire by default" and save, when I next open Add Product with a blank form (manual entry, or either scan path before a match/photo result arrives), then the "does it expire?" toggle's initial state reflects my saved preference — supersedes `Product Add.md`'s current hardcoded-`true` acceptance criterion (updated alongside this spec), everything else about that criterion (user can still switch it explicitly per product) is unchanged.
- [ ] Given the User Preferences category, when I view it, then I can pick my language (English (US) / Português do Brasil) — the same picker `specs/i18n.md` specs, hosted on this page; this spec owns where the control lives and how the choice is saved, `i18n.md` owns what happens in the UI once it changes (translation, `<html lang>`, etc.).
- [ ] Given User Preferences, when I view it, then there is **no** theme/dark-light control here — that already exists in the nav drawer footer per `specs/Menu.md` and is not duplicated.
- [ ] Given I change any Default Options or User Preferences field and click Save, when the save completes, then a success confirmation is shown (reusing the `Alert variant="success"` pattern `Inventory.md`'s save flow already uses) and the values persist across a full page reload.
- [ ] Given the Settings page fails to load its current values (API unreachable), when that happens, then an `Alert variant="danger"` with a "Try again" retry action is shown — same pattern as `Inventory.md`'s own load-failure state — rather than a blank/broken form.
- [ ] Given I submit Default Options/User Preferences with an invalid value (e.g. a negative minimal quantity, an unsupported language), when I try to save, then the request is rejected with a clear inline error and nothing is persisted — enforced both in the form and at `apps/api`, same defense-in-depth pattern `Persistence.md` documents for Product's own fields.

## Data

Single-user, single active row — no per-provider list, no `user_id` (matches `specs/Persistence.md`'s stated single-user scope). New Postgres table, `apps/api/src/db/schema.ts` (appended alongside the existing `products`/`batches`/`productAliases`/`barcodes` tables):

```ts
export const preferences = pgTable("preferences", {
  // Fixed singleton id — PATCH always upserts this one row via
  // onConflictDoUpdate; there is never more than one row in this table.
  id: text("id").primaryKey().default("singleton"),
  aiApiBaseUrl: text("ai_api_base_url"), // null = not configured
  aiApiKey: text("ai_api_key"), // plaintext; null = not configured. Never serialized back to a client in full — see API below.
  aiModel: text("ai_model"), // e.g. "gpt-4o-mini"; null = not configured
  defaultMinimalQuantity: integer("default_minimal_quantity").notNull().default(3), // was apps/web's DEFAULT_MINIMAL_QUANTITY constant
  defaultFreshnessThresholdDays: integer("default_freshness_threshold_days").notNull().default(7), // was apps/web's DEFAULT_FRESHNESS_THRESHOLD_DAYS constant
  defaultDoesExpire: boolean("default_does_expire").notNull().default(true), // was apps/web's BLANK_FORM.doesExpire literal
  language: text("language").notNull().default("en-US"), // "en-US" | "pt-BR" — see specs/i18n.md
});
```

**API surface** (`apps/api`, new `preferencesRouter` mounted at `app.use("/preferences", preferencesRouter)` in `apps/api/src/index.ts`, alongside the existing `productsRouter` mount):

```ts
// GET /preferences
// Returns the singleton row if it exists, else the column defaults above
// (3 / 7 / true / null / null / null / "en-US") without writing anything —
// the row is only ever created by the first PATCH (upsert).
interface PreferencesResponse {
  ai_api_base_url: string | null;
  ai_api_key_set: boolean;
  ai_api_key_hint: string | null; // `•••• ${last 4 chars}` when set, else null
  ai_model: string | null;
  default_minimal_quantity: number;
  default_freshness_threshold_days: number;
  default_does_expire: boolean;
  language: "en-US" | "pt-BR";
}

// PATCH /preferences
// Full-replace semantics for the six always-present fields (same "final
// desired state, not a diff" convention apps/api's PATCH /products/:id
// already uses) — the client always sends its whole form. ai_api_key is
// the one exception: omitted = leave the stored key unchanged, `null` =
// clear it, a non-empty string = replace it.
interface UpdatePreferencesPayload {
  ai_api_base_url: string | null;
  ai_api_key?: string | null;
  ai_model: string | null;
  default_minimal_quantity: number; // >= 0
  default_freshness_threshold_days: number; // >= 0
  default_does_expire: boolean;
  language: "en-US" | "pt-BR";
}
// Response: same shape as GET /preferences, reflecting the row after upsert.
```

**Migration**: author via `drizzle-kit generate` per `specs/Persistence.md`'s documented workflow (checked-in SQL file under `apps/api/drizzle/`) — not hand-written here.

**`apps/web` call sites this replaces** (module-level fallback constants → values read from the new preferences store):
- `apps/web/src/lib/freshness.ts`: delete the exported `DEFAULT_FRESHNESS_THRESHOLD_DAYS` constant (currently line 9); `freshnessStatus` and `formatExpiryLabel` each gain a new required `defaultThresholdDays: number` parameter (inserted after their existing `thresholdDays: number | null` parameter, before `today: Date`), replacing their internal `?? DEFAULT_FRESHNESS_THRESHOLD_DAYS` fallback with `?? defaultThresholdDays`.
- `apps/web/src/lib/inventory.ts`: delete the exported `DEFAULT_MINIMAL_QUANTITY` constant (currently line 5); `enrichProduct(product, batches, today, ...)` gains a new required 4th parameter `defaults: { freshnessThresholdDays: number; minimalQuantity: number }`, threading `defaults.freshnessThresholdDays` into its own internal `freshnessStatus`/`formatExpiryLabel` calls and using `defaults.minimalQuantity` in place of the deleted constant in its `isLow` calculation.
- `apps/web/src/lib/addProduct.ts`: replace the exported `BLANK_FORM` object constant with `export function buildBlankForm(defaultDoesExpire: boolean): AddProductFormState`, returning the same shape with `doesExpire: defaultDoesExpire` instead of the hardcoded literal. (`MOCK_BARCODE_MATCH`'s own `doesExpire: true` is unrelated — that's simulated real-product data, not a form default — and is untouched.)
- `apps/web/src/pages/Inventory.tsx`: all 6 current `BLANK_FORM` references (initial `useState`, and the reset-to-blank call sites after cancel/save/photo-prefill/match-prefill) become `buildBlankForm(preferences.default_does_expire)`; the `enrichProduct(...)` call site passes the new 4th `defaults` argument sourced from the same `preferences` object.
- `apps/web/src/pages/StockEdit.tsx`: its two `freshnessStatus(...)`/`formatExpiryLabel(...)` call sites each gain `preferences.default_freshness_threshold_days` as the new 3rd argument.

**New `apps/web/src/lib/preferencesStore.tsx`** (mirrors `apps/web/src/lib/productsStore.tsx`'s existing `ProductsProvider`/`useProductsStore` pattern exactly — context + provider fetching on mount, no other data-fetching library in this codebase):

```ts
export interface PreferencesStore {
  preferences: PreferencesResponse; // never null — see initial value below
  loading: boolean;
  error: string | null;
  refetch: () => void;
  save: (payload: UpdatePreferencesPayload) => Promise<void>; // calls PATCH, updates local state from the response
}
```
Initial state (before the `GET /preferences` fetch resolves) is the same literal defaults as the DB schema's column defaults — `{ ai_api_base_url: null, ai_api_key_set: false, ai_api_key_hint: null, ai_model: null, default_minimal_quantity: 3, default_freshness_threshold_days: 7, default_does_expire: true, language: "en-US" }` — so `Inventory.tsx`'s initial `useState<AddProductFormState>(buildBlankForm(...))` and `enrichProduct` calls never need a null-check while the fetch is in flight. `PreferencesProvider` wraps `App.tsx`'s tree alongside the existing `ProductsProvider` (`apps/web/src/App.tsx`).

**`apps/web/src/lib/api.ts` additions** (same `request<T>()` helper the file already uses for `fetchProducts`/`createProduct`/`updateProduct`):
```ts
export function fetchPreferences(): Promise<PreferencesResponse> {
  return request("/preferences");
}
export function updatePreferences(payload: UpdatePreferencesPayload): Promise<PreferencesResponse> {
  return request("/preferences", { method: "PATCH", body: JSON.stringify(payload) });
}
```

## UI requirements

- **Entry point**: unchanged — `specs/Menu.md`'s existing `/settings` route (`apps/web/src/pages/Settings.tsx`), which today renders only a "doesn't have real content yet" placeholder (delete that placeholder body entirely, this spec is what replaces it).
- **Layout**: single scrollable page inside `AppShell` (same chrome as Inventory — top app bar + hamburger, per `specs/Menu.md`; Settings does **not** get the chromeless full-screen treatment `Stock Edit.md`/`Product Edit.md` use). Three stacked sections in fixed order: AI Settings, Default Options, User Preferences. Each section: an uppercase-eyebrow-style subtitle (`text-xs font-semibold uppercase tracking-wide text-ink-muted`, matching this system's existing eyebrow-label type convention per `specs/Brand.md`'s type section) followed by its fields, followed by a `border-t border-border` divider before the next section (last section has no trailing divider).
- **AI Settings fields**: `Input` (text, label "API base URL", placeholder `https://api.openai.com/v1`) bound to `ai_api_base_url`; `Input` (`type="password"`, label "API key") bound to a local always-blank "new key" draft string — when `ai_api_key_set` is true, render a `hint` below it reading `A key is saved (${ai_api_key_hint}).` plus a text-button "Clear saved key" that arms a pending-clear flag (mutually exclusive with typing a new value — typing anything clears the pending-clear flag); `Input` (text, label "Model") bound to `ai_model`.
- **Default Options fields**: `Input` (`type="number"`, `min={0}`, label "Default minimal quantity") bound to `default_minimal_quantity`; `Input` (`type="number"`, `min={0}`, label "Default freshness threshold (days)") bound to `default_freshness_threshold_days`; `Switch` (label "Products expire by default", per `Switch`'s own doc comment example use-case) bound to `default_does_expire`.
- **User Preferences fields**: `Select` (label "Language", options `[{ value: "en-US", label: "English (US)" }, { value: "pt-BR", label: "Português do Brasil" }]`) bound to `language`. No other control in this section — no theme toggle (see Acceptance criteria).
- **Save**: one `Button` ("Save") at the bottom of the page, sends the full current form state as one `UpdatePreferencesPayload` (omitting `ai_api_key` unless the user typed a new one or armed "clear saved key", per the Data section's PATCH semantics). On success: `Alert variant="success" title="Saved"` shown briefly, same transient pattern `Inventory.tsx`'s `justSavedMessage` already uses. On failure: `Alert variant="danger"` with the `ApiError` message, form stays editable (not reset).
- **Loading state**: while `preferencesStore.loading` is true on first mount, render a simple loading placeholder (no skeleton component exists yet in `shelf-sense-ds` — plain centered text is fine, matching the level of polish `Settings.tsx`'s current placeholder already uses).
- **Load-error state**: if the initial `GET /preferences` fails, render `Alert variant="danger" title="Couldn't load your settings"` plus a "Try again" `Button variant="outline"` calling `refetch()` — identical pattern to `Inventory.tsx`'s own load-failure block.
- **Client-side validation**: both number fields reject negative/non-integer input before Save is enabled (same "hard validation error, not a soft warning" bar `Product Add.md`'s Non-functional section sets for its own fields).
- **No new `shelf-sense-ds` components needed** — `Input`, `Switch`, `Select`, `Button`, `Alert` all already exist and cover every field this page needs.
- Mobile-first (same as every other screen in this app per `specs/Menu.md`), but nothing here is camera/touch-specific — works identically on wider viewports.

## Non-functional

- **Secret handling**: the API key is stored plaintext in Postgres (explicit decision — single-user self-hosted app, the whole database is already trusted, matches this app's existing security posture). It is never included in `GET /preferences`'s response body in full, never logged (including in `apps/api` request/error logging), and the `PATCH` request body containing it is only ever sent over the same origin the rest of the app already talks to (no new transport surface).
- **No consumer wired up yet**: nothing in this pass actually calls the stored AI config — `Product Add.md`'s `identify-from-photo` is still `MOCK_BARCODE_MATCH`-simulated (per that spec's own current status). This spec only makes the config real and persisted; wiring a real AI call to use it is that consuming feature's own follow-up, not blocked by anything here.
- **Scope: `apps/web` only.** `apps/mobile` has no navigation/Settings surface yet — `specs/Menu.md`'s drawer, which Settings hangs off, is `apps/web`-only so far (confirmed: no `Settings`/`NavDrawer` equivalent exists under `apps/mobile/src`). Not building a parallel mobile Settings screen in this pass.
- **Validation enforced at both layers**: `apps/api`'s Zod schema for `PATCH /preferences` rejects negative/non-integer `default_minimal_quantity`/`default_freshness_threshold_days` and any `language` outside `"en-US" | "pt-BR"` with a 400, mirroring the form's own client-side checks — same defense-in-depth convention `specs/Persistence.md` documents for `Product`'s fields.
- **Accessibility**: every field uses `Input`/`Select`/`Switch`'s own existing label-association behavior (no new pattern needed); no modal/dialog involved so no new focus-trap concerns.

## Out of scope

- **Multiple AI provider configs** (a named list to add/remove/switch between) — one active config is enough for every current and near-term caller; revisit only once a real feature needs to pick between providers per-request.
- **Encrypting the API key at rest** — explicit decision for this single-user self-hosted app; revisit if this app ever grows multi-tenant/hosted deployment.
- **Wiring the stored AI config to any real feature** (`Product Add.md`'s `identify-from-photo`, a future barcode-lookup provider, etc.) — each consuming feature's own follow-up.
- **`apps/mobile` Settings** — no mobile nav surface exists yet to hang it off; see Non-functional.
- **i18n mechanics beyond persisting the chosen language** (actual translation, `<html lang>`, locale-aware formatting) — entirely `specs/i18n.md`'s concern; this spec only owns where the picker lives and that the choice is saved.
- **Changing the per-product-value-wins fallback semantics** — `Product.freshness_threshold_days`/`Product.minimal_quantity` being `null` still means "use the global default" exactly as today; this spec only makes that global default a real configured value instead of a hardcoded constant, nothing about the fallback rule itself changes.
