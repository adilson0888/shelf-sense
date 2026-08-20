# Barcode Scanner & Product info scrape

**Status:** done

## User story

As someone adding a product, I want scanning its barcode to be the default way ShelfSense adds a product — automatically finding it if I already have it, or filling in its details if it's new to me — so that typing everything by hand is the exception, not the rule.

## Acceptance criteria

This spec **substantially simplifies** `Product Add.md`'s current five-step flow (method choice → capture → match review → unlink warning → form). The photo/AI-vision method, the method-choice modal, and the match-review/unlink-warning pair are all retired here, not just left unbuilt — see Out of scope for what that removes.

- [ ] Given the user taps "+ Add" (Inventory or Product List) and the browser supports the `BarcodeDetector` API, when the button is tapped, then the barcode capture screen opens immediately — no method-choice step.
- [ ] Given the user taps "+ Add" and the browser does **not** support `BarcodeDetector`, when the button is tapped, then the manual Add Product page (`/products/add`) opens directly, blank — scanning is never offered, and there's no intermediate step explaining why.
- [ ] Given the capture screen is open, when a live camera feed is available, then `BarcodeDetector` runs continuously against it — the existing scan-frame/red-line visual (already built) overlays the real `<video>` feed instead of today's placeholder graphic. No manual "Capture" tap is needed; decoding a barcode completes the step automatically.
- [ ] Given the capture screen is open, when the user cancels it (the existing "Edit manually" ghost-button escape hatch, retargeted), then it closes and the manual Add Product page opens, blank — the same fallback destination whether the browser lacks support or the user simply backs out of a scan in progress.
- [ ] Given a barcode decodes, when the app checks it, then the match is **real**, not simulated: the decoded code is compared against the `barcodes` already present on every product loaded in the client's products store (client-side, no network call, works offline) — this retires `MOCK_BARCODE_MATCH` for the match case.
- [ ] Given the decoded barcode matches one already linked to one of the user's own products, when matched, then **Quick Batch Edit opens directly for that product** — no match-review/confirm screen, no "add as new" divergence for this path. Reuses `Quick Batch Edit.md`'s existing modal exactly as built (steppers, click-to-edit total, conditional expiry field) rather than a bespoke quantity/expiry mini-form.
- [ ] Given the decoded barcode does **not** match any of the user's own products, when that's confirmed, then the app queries **Open Food Facts** by the barcode value.
- [ ] Given Open Food Facts returns a match, when its raw fields are usable, then — if the user has AI credentials configured (`specs/Settings.md`) — they're fed through the user's configured AI provider (the same one this spec's `identify-from-photo`-successor logic would have used, had photo not been dropped — see Data) for the brand-aware split `specs/Prices & Product Differentiation.md`'s barcode-description model wants (see Data's `short_description`/`long_description` split below); with no AI configured, or the AI call fails, Open Food Facts' raw fields are used exactly as before this spec's later revision — a match never requires AI to be useful.
- [ ] Given Open Food Facts returns no match, errors, or times out, when that happens, then the app falls back to **Tavily**: searching the barcode number, then feeding the results through the same AI-provider extraction step. Unlike the Open Food Facts path, this one has no usable non-AI fallback — raw search snippets aren't real product fields — so it still requires Tavily/AI credentials to produce anything.
- [ ] Given Tavily also fails, returns nothing usable, or no Tavily/AI credentials are configured, when that happens, then the manual form opens **blank**, same as a genuine "nothing found anywhere" result.
- [ ] Given either external provider returns **partial** data, when the form opens, then whatever was found prefills its field(s); the rest stays blank — never blocked on a complete result.
- [ ] Given the form was reached via a scan that didn't resolve to an existing product (Open Food Facts/Tavily prefill, or nothing found), when the form renders, then a **"Link to existing product"** action appears beside Save — not shown when the form was reached with no scan at all (unsupported browser, or a cancelled scan).
- [ ] Given "Link to existing product" is tapped, when the search modal opens, then it shows a search bar (with a clear/"×" control, same pattern as the app's existing search inputs) and result cards, each showing that candidate product's short and long description.
- [ ] Given the user selects a candidate product, when selected, then a confirmation prompt appears; confirming links the scanned barcode to that product — reusing the exact unlink-and-relink mechanic `Product Add.md`'s "add as new" path already implements (a barcode never belongs to two products, even momentarily).
- [ ] Given the user cancels the search modal (Cancel button, or clicking outside), when cancelled, then it closes and returns to the form exactly as it was.
- [ ] Given the form is reached via any surviving path (blank via unsupported browser/cancel, or prefilled/blank via a non-matching scan), when it renders, then it's a real page at `/products/add`, not a modal — "go back" is real browser back navigation.

## Data

No changes to `Product`/`Batch` shape — same as the previous revision of this spec, this is entirely about how existing fields get filled in and linked. (**Later note**: `specs/Prices & Product Differentiation.md` does change both — `Product.long_description` is removed and `BarcodeLookupResult.long_description` below now prefills the scanned code's own `description` on Add Product instead of a product-level field. This spec's own lookup/fallback mechanism is otherwise unaffected. **Second later note**: `GET /products/lookup-barcode` now has a second caller — `Product Edit.md`'s scan-first "+ Add barcode" — unchanged endpoint, same response shape, just called from a second screen.)

**New `apps/api` endpoint**, proxied server-side (keeps provider keys off the client, one place for retry/timeout handling — same reasoning `Product Add.md`'s `identify-from-photo` used, even though Open Food Facts itself needs no key):

```ts
// GET /products/lookup-barcode?code=<barcode>
// response:
interface BarcodeLookupResult {
  short_description?: string;
  long_description?: string;
  source: "open-food-facts" | "tavily" | null; // null when nothing was found anywhere
}
```

Internally: query Open Food Facts by `code` first. A hit's raw fields (`product_name`, `generic_name`/`ingredients_text`) go through the same AI-extraction step as the Tavily path below when AI credentials are configured and the call succeeds; otherwise the raw fields are returned as-is (Open Food Facts alone has always been enough to be useful — see Acceptance criteria). On a miss/error/timeout, fall back to a Tavily search on `code`, then an AI-provider call (whatever's configured in Settings) — required here, no raw-snippet fallback; if that fails or no Tavily/AI credentials are configured, return `{ source: null }`.

**AI extraction, both paths** (`specs/Prices & Product Differentiation.md` made every product's differentiating detail live on its barcode's `description`, not a product field — this is what actually fills that in well instead of a name dump): the prompt asks for three parts, not the two `BarcodeLookupResult` exposes —

```
{
  "short_description": "generic/category name, brand-free",
  "variant_description": "pack size/type/other distinguishing detail, brand-free",
  "brand": "the brand if identifiable, else empty"
}
```

— and `long_description` is assembled server-side as `[variant_description, brand].filter(Boolean).join(" ")`, guaranteeing the brand always lands last regardless of what the model produces, rather than trusting it to self-order. Worked example, included in the prompt itself as a few-shot anchor (brand vs. generic-descriptor disambiguation is the fuzziest part of this and a concrete example measurably helps): raw text mentioning "Papel Higiênico folha dupla Neve 30m" → `short_description: "Papel Higiênico"`, `variant_description: "Folha dupla 30m"`, `brand: "Neve"` → assembled `long_description: "Folha dupla 30m Neve"`. (**Implemented note**: `apps/api/src/lib/barcodeLookup.ts`'s `extractProductDetails` — generalized from the old Tavily-only `extractWithAI` — and the `lookupBarcode` orchestration above are done and verified via `npm run typecheck`/a real build; the rest of this spec's scan-first Add Product flow predates this pass and isn't re-verified here.)

**`preferences` gains one field** (`apps/api/src/db/schema.ts`, alongside the existing `aiApiKey`):

```ts
tavilyApiKey: text("tavily_api_key"), // plaintext, same never-echoed-in-full convention as ai_api_key; null = not configured
```

`PreferencesResponse`/`UpdatePreferencesPayload` (`Settings.md`) each gain `tavily_api_key_set`/`tavily_api_key_hint` (response) and an optional `tavily_api_key` (request), mirroring `ai_api_key`'s existing shape exactly.

**Local match retires `MOCK_BARCODE_MATCH`**: instead of the canned fixture, the decoded code is checked against `products.flatMap(p => p.barcodes)` from the already-loaded client store — a real, offline-capable check, not a network call.

## UI requirements

- **Entry point**: "+ Add" (Inventory/Product List) branches on `BarcodeDetector` support — capture screen (supported) or `/products/add` blank (not supported). No method-choice modal exists anymore.
- **Capture screen**: real `<video>` feed once support is confirmed, existing scan-frame/red-line overlay kept as-is. Its "Edit manually" ghost button (already built) is retargeted to navigate to `/products/add` blank instead of setting local step state.
- **Local match → Quick Batch Edit**: the matched product is looked up in the already-loaded store and passed straight into the existing `openQuick(...)` flow (`Inventory.tsx`/`ProductList.tsx` already have this wired for long-press/swipe — this is a third entry point into the same function, not new modal logic).
- **Add Product page** (`/products/add`): styled consistent with `Product Edit.md`/`Stock Edit.md`'s chrome-less full-screen pattern (back control, eyebrow label, no `AppShell` hamburger/drawer).
- **"Link to existing product"**: a button beside Save, shown only per the acceptance criteria's trigger condition. Opens a `Modal` with a search `Input` (existing "×"-to-clear search pattern from `Product List.md`) and a scrollable list of result cards (short + long description).
- **Link confirmation**: reuses `Product Edit.md`'s existing "Move this barcode?" confirm dialog, naming the product the barcode is currently associated with (if any) and the one it's moving to.
- **Settings**: a "Tavily API key" `Input` (`type="password"`) in the existing AI Settings section, same masked-hint-plus-"Clear saved key" pattern the AI API key field already has.

## Non-functional

- **Correcting a wrong auto-match**: since scanning a matching barcode now skips straight to Quick Batch Edit with no "add as new" escape hatch, the correction path for a genuinely wrong match is: Cancel out of Quick Batch Edit, then use Product Edit's "+ Add barcode" flow (now scan-first itself, per that spec's later revision) on the *correct* product — that flow already handles "this code currently belongs to another product, move it?" via the existing conflict-and-confirm dialog. Nothing new needed; just a different entry point into an already-built correction path.
- **This spec makes real what `Product Add.md` previously simulated**: the capture screen's placeholder camera view, the "suggested but unbuilt" Open Food Facts lookup, and `MOCK_BARCODE_MATCH`'s local-match behavior all become real here. Amends `Product Add.md`'s Data/Non-functional sections and status line once this ships — including removing its now-superseded method-choice/photo/match-review/unlink-warning acceptance criteria.
- **Connectivity**: Open Food Facts and Tavily calls both require connectivity; local barcode matching stays offline-capable (now genuinely so, not just in principle).
- **Cost/latency**: any path through AI extraction (an Open Food Facts hit with AI configured, or the Tavily fallback) costs money and takes longer than a plain Open Food Facts hit returned raw — surfaced as its own loading state, not a silent block. An Open Food Facts hit with no AI configured stays as fast/free as before this spec's later revision.
- **Browser support**: gated on `BarcodeDetector` (Chromium-based browsers today). No JS-library polyfill in this pass.
- **Provider order is fixed** (Open Food Facts → Tavily → manual) and not user-configurable in this pass.
- **Validation**: unchanged from `Product Add.md` — `does_expire` + quantity > 0 + no `expires_on` is still a hard error, regardless of how the form got prefilled.

## Out of scope

- **The photo/AI-vision capture method entirely** — `identify-from-photo` (never actually implemented in `apps/api`, only documented) is dropped along with it. Reviving a photo-based entry method is a separate future spec if ever revisited, not a deferred piece of this one.
- **The method-choice modal, match-review screen, and unlink-warning modal** — all three become unreachable once scan is the default and matches skip straight to Quick Batch Edit; retired, not just unused.
- **`apps/mobile` scanning** — `ScanScreen.tsx` stays an unreplaced prototype; a separate future spec.
- **A `BarcodeDetector` polyfill/JS-library fallback** for unsupported browsers.
- ~~**Manually typing a barcode to trigger this same lookup pipeline** — camera-scan-triggered only; `Product Edit.md`'s manual-code-entry stays lookup-free.~~ No longer true as of `Product Edit.md`'s later revision: its "+ Add barcode" is scan-first now and does trigger this same lookup on a successful scan. Typing a code by hand (unsupported browser, or backing out of a scan) still never triggers a lookup — that half of this bullet still holds.
- **Configurable or reorderable provider priority.**
- **Rate-limit-specific handling for Open Food Facts** — any non-success response falls through to Tavily uniformly.
- **Giving Product Edit its own URL route** — still out of scope per that spec; unaffected by Add Product's move to a real route here.
