import type { Batch, Product } from "../types";

// Baked in at Vite build time — a published Docker image can't be pointed
// at a different API host without rebuilding. Fine for the documented
// local/self-hosted default (both ports published on the same host, see
// docker-compose.yml); a runtime-configurable base URL (e.g. an nginx
// entrypoint writing a small config.js) is a known follow-up, not solved
// here — see specs/Persistence.md.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchProducts(): Promise<{ products: Product[]; batches: Batch[] }> {
  return request("/products");
}

/** Built by apps/web/src/lib/addProduct.ts's buildCreateProductPayload(). */
export interface CreateProductPayload {
  short_description: string;
  does_expire: boolean;
  minimal_quantity: number | null;
  freshness_threshold_days: number | null;
  quantity: number;
  expires_on: string | null;
  // specs/Relative Tracking.md — fixed at creation, never edited afterward.
  tracking_mode: "units" | "percentage";
  stock_percent: number | null;
  minimal_percentage: number | null;
  // specs/Prices & Product Differentiation.md — description is always
  // required; code is either a real scanned/typed value or null, meaning
  // "generate one for me" (apps/api mints the smallest possible unique one).
  barcode: { code: string | null; description: string };
  // Optional; only meaningful alongside an initial batch (quantity > 0).
  price: number | null;
}

export function createProduct(payload: CreateProductPayload): Promise<{ product: Product; batch: Batch | null }> {
  return request("/products", { method: "POST", body: JSON.stringify(payload) });
}

/** specs/Prices & Product Differentiation.md — Stock Edit/Quick Batch Edit's real batch-mutation API (neither had one before this spec). */
export interface CreateBatchPayload {
  quantity: number;
  expires_on: string | null;
  barcode_id: string | null;
  price: number | null;
}

export function createBatch(productId: string, payload: CreateBatchPayload): Promise<{ batch: Batch }> {
  return request(`/products/${productId}/batches`, { method: "POST", body: JSON.stringify(payload) });
}

/**
 * Quantity change — reaching 0 marks the batch consumed server-side
 * instead of deleting it. `expires_on` is optional: omitted leaves it
 * unchanged, set/null updates it (Stock Edit's pre-existing inline
 * expiration edit — apps/api now persists it for real here).
 */
export interface UpdateBatchPayload {
  quantity: number;
  expires_on?: string | null;
}

export function updateBatch(productId: string, batchId: string, payload: UpdateBatchPayload): Promise<{ batch: Batch }> {
  return request(`/products/${productId}/batches/${batchId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

/** specs/Barcode Scanner & Product info scrape.md's external-lookup pipeline. */
export interface BarcodeLookupResult {
  short_description?: string;
  long_description?: string;
  source: "open-food-facts" | "tavily" | null;
}

export function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  return request(`/products/lookup-barcode?code=${encodeURIComponent(code)}`);
}

/** Built by apps/web/src/lib/productEdit.ts's buildEditProductPayload(). */
export interface UpdateProductPayload {
  short_description: string;
  does_expire: boolean;
  minimal_quantity: number | null;
  freshness_threshold_days: number | null;
  // specs/Relative Tracking.md — the one field of that spec Product Edit
  // does touch; tracking_mode/stock_percent are fixed at creation and never
  // sent here.
  minimal_percentage: number | null;
  aliases: string[];
  barcodes: { code: string; description: string }[];
  // Cross-product unlinks the confirm-move flow already resolved before
  // Save was clickable — see Product Edit.md's Data section.
  other_product_updates: { product_id: string; remove_barcode_codes: string[]; remove_aliases: string[] }[];
}

export function updateProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<{ product: Product; batches: Batch[] }> {
  return request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

/** Mirrors apps/api/src/routes/preferences.ts's toPreferencesJson() — see specs/Settings.md's Data section. */
export interface PreferencesResponse {
  ai_api_base_url: string | null;
  ai_api_key_set: boolean;
  ai_api_key_hint: string | null;
  ai_model: string | null;
  /** specs/Barcode Scanner & Product info scrape.md's Open-Food-Facts-miss fallback credential. */
  tavily_api_key_set: boolean;
  tavily_api_key_hint: string | null;
  default_minimal_quantity: number;
  default_freshness_threshold_days: number;
  default_does_expire: boolean;
  language: "en-US" | "pt-BR";
  /** specs/Relative Tracking.md's low-% fallback for percentage-tracked products. */
  default_minimal_percentage: number;
  /** False only when no preferences row has ever been saved — see specs/i18n.md's first-launch detection. */
  has_saved_preferences: boolean;
}

/** Built by apps/web/src/pages/Settings.tsx's Save handler. */
export interface UpdatePreferencesPayload {
  ai_api_base_url: string | null;
  ai_api_key?: string | null;
  ai_model: string | null;
  tavily_api_key?: string | null;
  default_minimal_quantity: number;
  default_freshness_threshold_days: number;
  default_does_expire: boolean;
  language: "en-US" | "pt-BR";
  default_minimal_percentage: number;
}

export function fetchPreferences(): Promise<PreferencesResponse> {
  return request("/preferences");
}

export function updatePreferences(payload: UpdatePreferencesPayload): Promise<PreferencesResponse> {
  return request("/preferences", { method: "PATCH", body: JSON.stringify(payload) });
}
