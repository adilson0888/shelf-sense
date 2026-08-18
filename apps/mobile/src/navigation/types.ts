import type { BarcodeLookupResult } from "shelf-sense-core";

export type RootRoute = "Inventory" | "Products" | "Grocery" | "Settings";

export type RootStackParamList = {
  Inventory: undefined;
  Products: undefined;
  Grocery: undefined;
  Settings: undefined;
  BarcodeScan: { from: RootRoute };
  AddProduct: { from: RootRoute; barcode?: string; lookup?: BarcodeLookupResult };
  ProductEdit: { from: RootRoute; productId: string };
  StockEdit: { productId: string };
  QuickEdit: { from: RootRoute; productId: string };
};
