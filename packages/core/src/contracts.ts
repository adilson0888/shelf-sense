import type { Batch, Product } from "./types.js";

export interface CreateProductPayload {
  short_description: string;
  long_description: string;
  does_expire: boolean;
  minimal_quantity: number | null;
  freshness_threshold_days: number | null;
  quantity: number;
  expires_on: string | null;
  tracking_mode: "units" | "percentage";
  stock_percent: number | null;
  minimal_percentage: number | null;
  barcode: string | null;
}

export interface BarcodeLookupResult {
  short_description?: string;
  long_description?: string;
  source: "open-food-facts" | "tavily" | null;
}

export interface UpdateProductPayload {
  short_description: string;
  long_description: string;
  does_expire: boolean;
  minimal_quantity: number | null;
  freshness_threshold_days: number | null;
  minimal_percentage: number | null;
  aliases: string[];
  barcodes: { code: string; description: string }[];
  other_product_updates: { product_id: string; remove_barcode_codes: string[]; remove_aliases: string[] }[];
}

export interface PreferencesResponse {
  ai_api_base_url: string | null;
  ai_api_key_set: boolean;
  ai_api_key_hint: string | null;
  ai_model: string | null;
  tavily_api_key_set: boolean;
  tavily_api_key_hint: string | null;
  default_minimal_quantity: number;
  default_freshness_threshold_days: number;
  default_does_expire: boolean;
  language: "en-US" | "pt-BR";
  default_minimal_percentage: number;
  has_saved_preferences: boolean;
}

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

export interface ProductsSnapshot {
  products: Product[];
  batches: Batch[];
}
