import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { comparisonSites } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

/**
 * specs/Price comparison.md's Settings CRUD for the user's saved shopping
 * sites. Plain list management — no per-search subset picker, no
 * reordering (display order is insertion order, see schema.ts).
 */
export const comparisonSitesRouter = Router();

function toJson(row: typeof comparisonSites.$inferSelect) {
  return { id: row.id, label: row.label, domain: row.domain };
}

// drizzle-orm wraps the real pg error in its own class, with the
// code/constraint fields on .cause — same shape products.ts's own
// pgUniqueViolationConstraint() checks.
function domainConflictError(err: unknown): HttpError | undefined {
  for (const candidate of [err, (err as { cause?: unknown } | null)?.cause]) {
    if (candidate && typeof candidate === "object" && "code" in candidate && (candidate as { code?: string }).code === "23505") {
      return new HttpError(409, "That domain is already saved");
    }
  }
  return undefined;
}

comparisonSitesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(comparisonSites).orderBy(asc(comparisonSites.createdAt));
    res.json({ sites: rows.map(toJson) });
  }),
);

const siteSchema = z.object({
  label: z.string().trim().min(1, "label is required"),
  domain: z.string().trim().min(1, "domain is required"),
});

comparisonSitesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = siteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    try {
      const [row] = await db
        .insert(comparisonSites)
        .values({ id: randomUUID(), label: parsed.data.label, domain: parsed.data.domain })
        .returning();
      res.status(201).json({ site: toJson(row) });
    } catch (err) {
      throw domainConflictError(err) ?? err;
    }
  }),
);

comparisonSitesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = siteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    try {
      const [row] = await db
        .update(comparisonSites)
        .set({ label: parsed.data.label, domain: parsed.data.domain })
        .where(eq(comparisonSites.id, req.params.id))
        .returning();
      if (!row) throw new HttpError(404, "Comparison site not found");
      res.json({ site: toJson(row) });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw domainConflictError(err) ?? err;
    }
  }),
);

comparisonSitesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = await db.delete(comparisonSites).where(eq(comparisonSites.id, req.params.id)).returning({ id: comparisonSites.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "Comparison site not found");
    }
    res.status(204).end();
  }),
);
