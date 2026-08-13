import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { preferences } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

export const preferencesRouter = Router();

const SINGLETON_ID = "singleton";

// Column defaults, duplicated here (not read off the schema at runtime) so
// GET can return them without writing a row — see specs/Settings.md's Data
// section: "the row is only ever created by the first PATCH (upsert)."
const DEFAULT_ROW: typeof preferences.$inferSelect = {
  id: SINGLETON_ID,
  aiApiBaseUrl: null,
  aiApiKey: null,
  aiModel: null,
  defaultMinimalQuantity: 3,
  defaultFreshnessThresholdDays: 7,
  defaultDoesExpire: true,
  language: "en-US",
};

// --- Shared row -> JSON reshaping (GET and PATCH both need this). Never
// echoes the real ai_api_key — only whether one is set, plus a masked hint. ---
function toPreferencesJson(row: typeof preferences.$inferSelect) {
  return {
    ai_api_base_url: row.aiApiBaseUrl,
    ai_api_key_set: row.aiApiKey !== null,
    ai_api_key_hint: row.aiApiKey ? `•••• ${row.aiApiKey.slice(-4)}` : null,
    ai_model: row.aiModel,
    default_minimal_quantity: row.defaultMinimalQuantity,
    default_freshness_threshold_days: row.defaultFreshnessThresholdDays,
    default_does_expire: row.defaultDoesExpire,
    language: row.language,
  };
}

/**
 * GET / — the singleton row if it exists, else the column defaults above,
 * without writing anything.
 */
preferencesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [row] = await db.select().from(preferences).where(eq(preferences.id, SINGLETON_ID)).limit(1);
    res.json(toPreferencesJson(row ?? DEFAULT_ROW));
  }),
);

// Full-replace semantics for the six always-present fields (same "final
// desired state, not a diff" convention apps/api's PATCH /products/:id
// already uses). ai_api_key is the one exception, handled outside this
// schema (see keyProvided below) — omitted = leave unchanged, null = clear,
// a non-empty string = replace.
const updatePreferencesSchema = z.object({
  ai_api_base_url: z.string().nullable(),
  ai_api_key: z.string().min(1, "ai_api_key cannot be blank").nullable().optional(),
  ai_model: z.string().nullable(),
  default_minimal_quantity: z.number().int().nonnegative(),
  default_freshness_threshold_days: z.number().int().nonnegative(),
  default_does_expire: z.boolean(),
  language: z.enum(["en-US", "pt-BR"]),
});

/**
 * PATCH / — upserts the singleton row. specs/Settings.md's Non-functional
 * section: the API key is never logged and never echoed back in full (see
 * toPreferencesJson above).
 */
preferencesRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = updatePreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const input = parsed.data;
    // Distinguishes "key field omitted" (undefined either way once parsed)
    // from "key explicitly cleared" — Zod alone can't tell those apart.
    const keyProvided = "ai_api_key" in req.body;

    const [row] = await db
      .insert(preferences)
      .values({
        id: SINGLETON_ID,
        aiApiBaseUrl: input.ai_api_base_url,
        aiApiKey: keyProvided ? (input.ai_api_key ?? null) : null,
        aiModel: input.ai_model,
        defaultMinimalQuantity: input.default_minimal_quantity,
        defaultFreshnessThresholdDays: input.default_freshness_threshold_days,
        defaultDoesExpire: input.default_does_expire,
        language: input.language,
      })
      .onConflictDoUpdate({
        target: preferences.id,
        set: {
          aiApiBaseUrl: input.ai_api_base_url,
          aiModel: input.ai_model,
          defaultMinimalQuantity: input.default_minimal_quantity,
          defaultFreshnessThresholdDays: input.default_freshness_threshold_days,
          defaultDoesExpire: input.default_does_expire,
          language: input.language,
          ...(keyProvided ? { aiApiKey: input.ai_api_key ?? null } : {}),
        },
      })
      .returning();

    res.json(toPreferencesJson(row));
  }),
);
