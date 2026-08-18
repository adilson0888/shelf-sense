import type {
  BarcodeLookupResult,
  Batch,
  CreateProductPayload,
  PreferencesResponse,
  Product,
  UpdatePreferencesPayload,
  UpdateProductPayload,
} from "shelf-sense-core";

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


export function createProduct(payload: CreateProductPayload): Promise<{ product: Product; batch: Batch | null }> {
  return request("/products", { method: "POST", body: JSON.stringify(payload) });
}


export function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  return request(`/products/lookup-barcode?code=${encodeURIComponent(code)}`);
}


export function updateProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<{ product: Product; batches: Batch[] }> {
  return request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}


export function fetchPreferences(): Promise<PreferencesResponse> {
  return request("/preferences");
}

export function updatePreferences(payload: UpdatePreferencesPayload): Promise<PreferencesResponse> {
  return request("/preferences", { method: "PATCH", body: JSON.stringify(payload) });
}
