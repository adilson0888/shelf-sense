/**
 * specs/Price comparison.md — POST /price-search's pipeline. Reuses
 * barcodeLookup.ts's Tavily-search + AI-extraction pattern, generalized
 * from "one product's fields" to a batched barcode × site price matrix:
 * one Tavily search per barcode (restricted to the user's saved comparison
 * sites via include_domains), then ONE AI-extraction call across every
 * barcode's raw results together — see that spec's Non-functional
 * cost/latency note on why this isn't one AI call per barcode.
 */
import { tavilySearch, withTimeout } from "./barcodeLookup.js";

export interface ComparisonSiteInput {
  id: string;
  label: string;
  domain: string;
}

export interface PriceSearchBarcodeInput {
  id: string;
  code: string;
  label: string;
}

export interface PriceSearchResult {
  site_id: string;
  label: string;
  price: number | null;
}

export interface PriceSearchRow {
  barcode_id: string;
  label: string;
  results: PriceSearchResult[];
}

export interface PriceSearchCredentials {
  tavilyApiKey: string | null;
  aiApiBaseUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
}

// Longer than barcodeLookup's own AI_TIMEOUT_MS (15s) — this prompt covers
// every searched barcode's raw snippets in one call, not just one product's.
const AI_TIMEOUT_MS = 25_000;

function emptyRows(barcodes: PriceSearchBarcodeInput[], sites: ComparisonSiteInput[]): PriceSearchRow[] {
  return barcodes.map((b) => ({
    barcode_id: b.id,
    label: b.label,
    results: sites.map((s) => ({ site_id: s.id, label: s.label, price: null })),
  }));
}

/**
 * One chat-completion call asked to return a full JSON matrix —
 * `{ "<barcode_id>": { "<site_id>": price | null, ... }, ... }` — parsed
 * defensively: a response that doesn't parse, or omits a barcode/site,
 * just leaves that cell `null` ("checked, nothing found"), same
 * fails-through-cleanly rule extractProductDetails already applies.
 */
async function extractPriceMatrix(
  barcodes: { id: string; label: string; snippets: string }[],
  sites: ComparisonSiteInput[],
  creds: Pick<PriceSearchCredentials, "aiApiBaseUrl" | "aiApiKey" | "aiModel">,
): Promise<Map<string, Map<string, number>>> {
  const empty = new Map<string, Map<string, number>>();
  if (!creds.aiApiBaseUrl || !creds.aiApiKey) return empty;

  const sitesList = sites.map((s) => `"${s.id}" = ${s.label} (${s.domain})`).join("\n");
  const barcodesBlock = barcodes.map((b) => `Barcode id "${b.id}" (${b.label}) search results:\n${b.snippets}`).join("\n\n");
  const prompt = [
    `You're extracting current retail prices from web search results, one product per barcode, one price per site.`,
    `Sites (id = label (domain)):`,
    sitesList,
    ``,
    barcodesBlock,
    ``,
    `Respond with ONLY a JSON object mapping each barcode id to an object mapping each site id to that site's current price as a plain number (no currency symbol), for every site whose domain the results actually confirm a price on. Omit a site id entirely if its results don't confirm a price for that barcode.`,
    `Example shape: {"<barcode_id>": {"<site_id>": 10.5}}`,
  ].join("\n");

  try {
    const postChat = (extra: Record<string, unknown>) =>
      withTimeout(AI_TIMEOUT_MS, (signal) =>
        fetch(`${creds.aiApiBaseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.aiApiKey}` },
          body: JSON.stringify({
            model: creds.aiModel || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            ...extra,
          }),
          signal,
        }),
      );

    // Same 400-on-temperature retry barcodeLookup.ts's extractProductDetails uses.
    let res = await postChat({ temperature: 0 });
    if (!res.ok && res.status === 400) {
      const errBody = await res.clone().text();
      if (/temperature/i.test(errBody)) {
        res = await postChat({});
      }
    }
    if (!res.ok) return empty;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return empty;
    const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonText) as Record<string, Record<string, number>>;

    const matrix = new Map<string, Map<string, number>>();
    for (const [barcodeId, bySite] of Object.entries(parsed)) {
      if (typeof bySite !== "object" || bySite === null) continue;
      const siteMap = new Map<string, number>();
      for (const [siteId, price] of Object.entries(bySite)) {
        if (typeof price === "number" && Number.isFinite(price)) siteMap.set(siteId, price);
      }
      matrix.set(barcodeId, siteMap);
    }
    return matrix;
  } catch {
    return empty;
  }
}

/**
 * Orchestrates POST /price-search. Every failure mode (no credentials, no
 * saved sites, Tavily/AI errors) resolves to the same "every cell null"
 * shape rather than throwing — a third-party outage shouldn't 500 the
 * modal, it should just show "Not found" everywhere, same fails-through-
 * cleanly convention lookupBarcode already established.
 */
export async function searchPrices(
  barcodes: PriceSearchBarcodeInput[],
  sites: ComparisonSiteInput[],
  creds: PriceSearchCredentials,
): Promise<PriceSearchRow[]> {
  if (!creds.tavilyApiKey || !creds.aiApiBaseUrl || !creds.aiApiKey || sites.length === 0) {
    return emptyRows(barcodes, sites);
  }

  const domains = sites.map((s) => s.domain);
  const searches = await Promise.all(
    barcodes.map(async (b) => ({ barcode: b, results: await tavilySearch(b.code, creds.tavilyApiKey as string, domains) })),
  );
  const withResults = searches.filter((s): s is { barcode: PriceSearchBarcodeInput; results: NonNullable<typeof s.results> } =>
    Boolean(s.results?.length),
  );
  if (withResults.length === 0) return emptyRows(barcodes, sites);

  const matrix = await extractPriceMatrix(
    withResults.map((s) => ({
      id: s.barcode.id,
      label: s.barcode.label,
      snippets: s.results.map((r) => `- ${r.title}: ${r.content}`).join("\n"),
    })),
    sites,
    creds,
  );

  return barcodes.map((b) => ({
    barcode_id: b.id,
    label: b.label,
    results: sites.map((s) => ({ site_id: s.id, label: s.label, price: matrix.get(b.id)?.get(s.id) ?? null })),
  }));
}
