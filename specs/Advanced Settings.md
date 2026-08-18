# Advanced Settings

**Status:** in-progress — `apps/api`'s per-field env-var fallback (`products.ts`'s `lookup-barcode` credential resolution, `preferences.ts`'s `env_defaults`) and `apps/web`'s Settings UI (operator-provided hints on all four AI Settings fields) implemented and verified against a real running server. `apps/api/.env.example` documents the four new optional vars.

## User story

As a self-hosted operator, I want to pre-configure AI and Tavily credentials via environment variables at deploy time, so the app's AI-assisted features (`specs/Barcode Scanner & Product info scrape.md`'s Tavily/AI fallback) work out of the box without the single user having to go find and paste in their own API keys first.

As that same app's user, I want my own key/model/URL saved in Settings to always win over whatever the operator configured, so I can use my own provider account when I want to, without needing the operator to change anything.

## Acceptance criteria

This spec is a narrower change than it might sound: `specs/Settings.md` already built the storage, masked-hint, and clear-key UI for `ai_api_base_url`/`ai_api_key`/`ai_model`, and `specs/Barcode Scanner & Product info scrape.md` already added `tavily_api_key` alongside them and wired all four into a real `LookupCredentials` read at `apps/api/src/routes/products.ts`'s `GET /products/lookup-barcode` handler. This spec adds one missing layer underneath that: an env-var fallback, checked only when the user hasn't saved their own value.

- [ ] Given the operator sets `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and/or `TAVILY_API_KEY` (any subset — each is independent, matching how the four fields are already independently optional in Settings), when a request needs credentials and the corresponding `preferences` column is `null`, then that env var's value is used instead.
- [ ] Given the user *has* saved their own value for a field in Settings, when credentials are resolved, then the user's value is used regardless of whether an env var is also set for that field — per-field precedence is always `preferences` row value, then env var, then nothing, independently for each of the four fields (e.g. an operator-set `AI_API_KEY` plus a user-set `AI_MODEL` combine into one working config; neither one field's source affects another field's resolution).
- [ ] Given the user clears their own saved key (existing "Clear saved key" action, `specs/Settings.md`'s UI requirements), when the save completes, then resolution falls back to the env var for that field if one is set, or to "not configured" if not — exactly today's "fallback to the env provided credentials" behavior, just restated against the new two-layer resolution instead of the single DB layer it's checked against today.
- [ ] Given neither the user nor the operator has provided a valid value for a credential a feature needs, when that feature runs (currently only `GET /products/lookup-barcode`'s Tavily/AI fallback), then it behaves exactly as it does today with no credentials configured — degrades gracefully (`source: null` / falls through to the next provider / blank form), never a hard error. This is a regression guard, not new behavior: `apps/api/src/lib/barcodeLookup.ts` already does this for "nothing configured"; this criterion just confirms adding the env layer doesn't change that.
- [ ] Given the operator has set an env var for a field the user hasn't configured, when the user opens Settings, then that field shows it's operator-provided (see UI requirements) rather than looking indistinguishable from "nothing is configured anywhere" — this is the one genuinely new user-facing behavior in this spec.

## Data

**`apps/api` reads four new env vars** (bare names, no prefix — matches `DATABASE_URL`'s existing convention; `apps/api` is plain Node, not Vite/Expo, so no `VITE_`/`EXPO_PUBLIC_` prefix requirement applies): `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `TAVILY_API_KEY`. All optional; the app runs the same as today (no AI features) if none are set.

**`apps/api/src/routes/products.ts`'s credentials read** (currently ~line 86-87, straight off the `preferences` row) becomes a per-field fallback:

```ts
const [prefsRow] = await db.select().from(preferences).where(eq(preferences.id, SINGLETON_PREFS_ID)).limit(1);
const credentials: LookupCredentials = {
  aiApiBaseUrl: prefsRow?.aiApiBaseUrl ?? process.env.AI_API_BASE_URL ?? null,
  aiApiKey: prefsRow?.aiApiKey ?? process.env.AI_API_KEY ?? null,
  aiModel: prefsRow?.aiModel ?? process.env.AI_MODEL ?? null,
  tavilyApiKey: prefsRow?.tavilyApiKey ?? process.env.TAVILY_API_KEY ?? null,
};
```

`apps/api/src/lib/barcodeLookup.ts`'s `LookupCredentials` interface and `lookupBarcode` itself are unchanged — they already just take resolved strings-or-null, with no opinion on where they came from.

**`GET /preferences` gains one field** (`apps/api/src/routes/preferences.ts`'s `toPreferencesJson`), so Settings can tell "operator provided this" apart from "nothing anywhere" without the client needing its own copy of `process.env`:

```ts
interface PreferencesResponse {
  // ...unchanged existing fields...
  env_defaults: {
    ai_api_base_url: string | null;  // process.env.AI_API_BASE_URL, or null
    ai_api_key_set: boolean;         // !!process.env.AI_API_KEY — never the raw value, same never-echoed convention as ai_api_key_set
    ai_model: string | null;         // process.env.AI_MODEL, or null
    tavily_api_key_set: boolean;     // !!process.env.TAVILY_API_KEY
  };
}
```

`env_defaults` is read fresh off `process.env` on every `GET /preferences` — it's not stored, not part of the `preferences` table, and `PATCH /preferences` never touches it (there is nothing for a user to write here; env vars are operator/deploy-time only, per this spec's Out of scope).

## UI requirements

All changes are in `apps/web/src/pages/Settings.tsx`'s existing AI Settings section (`specs/Settings.md`'s layout, fields, and Save mechanics are otherwise unchanged) — the four fields split into two UI treatments depending on whether they're secret-shaped:

- **`ai_api_key` / `tavily_api_key`** (the two masked, hint-plus-clear fields): when the user has **not** saved their own key (`ai_api_key_set: false`) and `env_defaults.ai_api_key_set` is `true`, show a hint reading "Provided by your administrator." in place of today's "not configured" (no hint at all) state — no "Clear saved key" action shown here, since there is no user-owned key to clear. The password input itself stays present and editable (typing and saving a value always creates a user-owned override, per the acceptance criteria's precedence rule). Once the user has saved their own key, behavior is exactly `specs/Settings.md`'s existing hint/clear UI, unchanged — clearing it reverts the display to the operator-provided hint above (if `env_defaults` still has one) or to "not configured" (if not).
- **`ai_api_base_url` / `ai_model`** (plain text fields, not masked — the value itself isn't a secret): when the field is blank (`null`) and the matching `env_defaults` entry is non-null, show a hint below the input reading `Using your administrator's default: ${value}.` — visible text, not just a placeholder, so it's not lost to anyone not looking closely at greyed-out placeholder text. Typing anything into the field and saving creates a user-owned override exactly as today; the hint disappears once the field has its own saved value.
- No change to Default Options or User Preferences — this spec only touches the AI Settings section.

## Non-functional

- **Secrets stay off the client exactly as today**: `env_defaults.ai_api_key_set`/`tavily_api_key_set` are booleans only — the real env var values are never sent to the browser, matching `specs/Settings.md`'s existing "never echoed in full" rule for the DB-stored keys.
- **Never logged**: resolved credentials (whichever layer they came from) follow the same never-logged rule `specs/Settings.md` already states for the DB-stored ones.
- **`.env.example` / deployment docs**: `apps/api/.env.example` gains commented-out examples for all four vars; `docker-compose.yml`/`docker-compose.registry.yml` don't need them (nothing sets AI credentials there today, and this spec doesn't require operators to use Docker env vars over Settings — it's an option, not a new requirement).
- **Validation**: no format validation on any of the four env vars (same as their DB-stored counterparts today — `apps/api` doesn't probe a provider to check a key actually works, it only checks presence).

## Out of scope

- **Operator-configuring env vars through any UI** — these are deploy-time environment variables only (container env, `.env` file, host env), never written by the app itself. `PATCH /preferences` cannot set them, and there's no admin UI distinct from the single user's own Settings page (this app has no multi-role auth — see `specs/Persistence.md`'s single-user scope note).
- **Per-field "reset to administrator default" action** — clearing a user-saved key/value already achieves this (falls back to the env layer if present); no separate button needed.
- **Any env var beyond the four listed here** — `specs/Database Configuration.md` covers the separate `DB_*` connection variables; nothing else in this app currently has a credential/config field that would benefit from an env-var layer.
- **Encrypting credentials at rest, multi-provider lists, wiring AI config into any feature beyond the existing barcode lookup** — all already out of scope per `specs/Settings.md`, unchanged by this spec.
