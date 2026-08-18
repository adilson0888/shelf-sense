import type {
  BarcodeLookupResult,
  Batch,
  CreateProductPayload,
  PreferencesResponse,
  Product,
  ProductsSnapshot,
  UpdatePreferencesPayload,
  UpdateProductPayload,
} from "shelf-sense-core";
import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, "configuration.apiUrlMissing");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "errors.network");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  fetchProducts(): Promise<ProductsSnapshot> {
    return request("/products");
  },
  createProduct(payload: CreateProductPayload): Promise<{ product: Product; batch: Batch | null }> {
    return request("/products", { method: "POST", body: JSON.stringify(payload) });
  },
  lookupBarcode(code: string): Promise<BarcodeLookupResult> {
    return request(`/products/lookup-barcode?code=${encodeURIComponent(code)}`);
  },
  updateProduct(id: string, payload: UpdateProductPayload): Promise<{ product: Product; batches: Batch[] }> {
    return request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  fetchPreferences(): Promise<PreferencesResponse> {
    return request("/preferences");
  },
  updatePreferences(payload: UpdatePreferencesPayload): Promise<PreferencesResponse> {
    return request("/preferences", { method: "PATCH", body: JSON.stringify(payload) });
  },
};
