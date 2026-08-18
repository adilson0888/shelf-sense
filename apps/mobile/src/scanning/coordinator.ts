import type { BarcodeLookupResult, Product } from "shelf-sense-core";

export type BarcodeDestination =
  | { route: "QuickEdit"; productId: string }
  | { route: "AddProduct"; barcode: string; lookup: BarcodeLookupResult };
export function findProductByBarcode(code: string, products: Product[]): Product | null {
  return products.find((product) => product.barcodes.some((barcode) => barcode.code === code)) ?? null;
}

export async function resolveBarcodeDestination(
  code: string,
  products: Product[],
  lookupBarcode: (code: string) => Promise<BarcodeLookupResult>,
): Promise<BarcodeDestination> {
  const local = findProductByBarcode(code, products);
  if (local) return { route: "QuickEdit", productId: local.id };
  return { route: "AddProduct", barcode: code, lookup: await lookupBarcode(code) };
}
