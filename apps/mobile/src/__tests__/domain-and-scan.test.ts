import { applyQuickEdit, enrichProduct, openStockEditState, addBatch, type Batch, type InventoryDefaults, type Product } from "shelf-sense-core";
import { resolveBarcodeDestination } from "../scanning/coordinator";

const defaults: InventoryDefaults = { freshnessThresholdDays: 7, minimalQuantity: 3, minimalPercentage: 20 };
const formatter = {
  t: (key: string) => key,
  tPlural: (key: string, count: number) => `${key}:${count}`,
  formatDate: (date: string) => date,
};

function product(overrides: Partial<Product> = {}): Product {
  return { id: "p1", short_description: "Rice", long_description: "", aliases: [], freshness_threshold_days: null, minimal_quantity: null, does_expire: false, barcodes: [], tracking_mode: "units", stock_percent: null, minimal_percentage: null, ...overrides };
}

test("percentage equality is low while unit equality is not low", () => {
  const percentage = enrichProduct(product({ tracking_mode: "percentage", stock_percent: 20 }), [], new Date("2026-08-15T12:00:00"), defaults, formatter);
  const units = enrichProduct(product(), [{ id: "b1", product_id: "p1", quantity: 3, expires_on: null }], new Date("2026-08-15T12:00:00"), defaults, formatter);
  expect(percentage.isLow).toBe(true);
  expect(units.isLow).toBe(false);
});

test("local barcode match skips lookup and a miss returns prefilled Add", async () => {
  const existing = product({ barcodes: [{ id: "bc1", product_id: "p1", code: "123", description: "box" }] });
  const lookup = jest.fn().mockResolvedValue({ source: "open-food-facts", short_description: "Beans" });
  await expect(resolveBarcodeDestination("123", [existing], lookup)).resolves.toEqual({ route: "QuickEdit", productId: "p1" });
  expect(lookup).not.toHaveBeenCalled();
  await expect(resolveBarcodeDestination("999", [existing], lookup)).resolves.toEqual({ route: "AddProduct", barcode: "999", lookup: { source: "open-food-facts", short_description: "Beans" } });
  expect(lookup).toHaveBeenCalledWith("999");
});

test("session-only Quick and Stock edits disappear when server snapshot is bootstrapped again", () => {
  const serverBatches: Batch[] = [{ id: "b1", product_id: "p1", quantity: 3, expires_on: null }];
  const quickSession = applyQuickEdit(serverBatches, "p1", false, 2, "");
  expect(quickSession[0]?.quantity).toBe(3);
  expect(quickSession[1]?.quantity).toBe(2);
  let stockSession = openStockEditState("p1", serverBatches);
  stockSession = { ...stockSession, addOpen: true, newQty: "4" };
  stockSession = addBatch(stockSession, false);
  expect(stockSession.batches).toHaveLength(2);
  const rebooted = serverBatches.map((batch) => ({ ...batch }));
  expect(rebooted).toEqual(serverBatches);
  expect(rebooted).toHaveLength(1);
});
