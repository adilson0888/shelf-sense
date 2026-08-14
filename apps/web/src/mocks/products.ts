import type { Barcode, Batch, Product } from "../types";

/**
 * Placeholder data standing in for apps/api's future /products endpoint —
 * see Inventory.md's Non-functional section (offline caching / real
 * data wiring is a follow-up once that API exists).
 *
 * Dates are offsets from "today" (computed at load time) rather than fixed
 * ISO strings, so the demo stays representative of every freshness state
 * (expired / expiring-soon / fresh / no-expiration) no matter when it runs
 * — the design this was built from used fixed dates pinned to one day.
 */
function isoDaysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

interface MockEntry {
  product: Omit<Product, "id" | "barcodes">;
  batches: { quantity: number; expiresInDays: number | null }[];
  // Descriptions are intentionally a little messy here (see "Biscoito Cream
  // Cracker" under Queijo Ralado below) — real barcode descriptions start
  // blank or get typed in a hurry (Product Edit.md's Non-functional
  // section), so a demo where every one is already tidy would hide why the
  // inline-edit-to-fix affordance exists. Same barcode values as the
  // approved Claude Design prototype (templates/product-list-alt), for
  // continuity between the two.
  barcodes: { code: string; description: string }[];
}

const MOCK_ENTRIES: MockEntry[] = [
  {
    product: {
      short_description: "Queijo Ralado",
      long_description: "Queijo Parmesão ralado em saquinho",
      aliases: ["grated cheese", "shredded parmesan"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [
      { quantity: 2, expiresInDays: 2 },
      { quantity: 3, expiresInDays: 41 },
    ],
    // Matches addProduct.ts's MOCK_BARCODE_MATCH ("7 891234 560123",
    // display-formatted there) — scanning that barcode in Add Product
    // "finds" this same product for a reason.
    barcodes: [
      { code: "7891234560123", description: "Queijo Ralado" },
      { code: "7891150066702", description: "Biscoito Cream Cracker" },
    ],
  },
  {
    product: {
      short_description: "White Rice",
      long_description: "Arroz branco tipo 1, saco",
      aliases: ["arroz"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: false,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [{ quantity: 5, expiresInDays: null }],
    barcodes: [
      { code: "7894900011517", description: "Arroz Branco 1kg" },
      { code: "7896003714408", description: "Açúcar Refinado 1kg" },
      { code: "7896102500018", description: "Sal Refinado 1kg" },
    ],
  },
  {
    product: {
      short_description: "Canned Black Beans",
      long_description: "Feijão preto em lata, pronto para consumo",
      aliases: ["feijao preto lata"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [
      { quantity: 1, expiresInDays: -26 },
      { quantity: 4, expiresInDays: 153 },
    ],
    barcodes: [{ code: "7896036090619", description: "Feijão Preto 1kg" }],
  },
  {
    product: {
      short_description: "Toilet Paper",
      long_description: "Papel higiênico folha dupla, pacote",
      aliases: ["papel higienico"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: false,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [{ quantity: 12, expiresInDays: null }],
    barcodes: [], // demonstrates the barcode table's empty state
  },
  {
    product: {
      short_description: "Cottage Cheese",
      long_description: "Requeijão cremoso, pote",
      aliases: ["requeijao"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [{ quantity: 1, expiresInDays: 1 }],
    barcodes: [
      { code: "7891000100103", description: "Leite Integral 1L" },
      { code: "7896004004501", description: "Café Torrado 500g" },
    ],
  },
  {
    product: {
      short_description: "Canned Corn",
      long_description: "Milho verde em conserva, lata",
      aliases: ["milho lata"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [
      { quantity: 2, expiresInDays: -1 },
      { quantity: 1, expiresInDays: 4 },
    ],
    barcodes: [{ code: "7891910000197", description: "Macarrão Espaguete" }],
  },
  {
    product: {
      short_description: "Baby Carrots",
      long_description: "Cenoura baby, saco",
      aliases: ["cenoura"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      tracking_mode: "units" as const,
      stock_percent: null,
      minimal_percentage: null,
    },
    batches: [{ quantity: 1, expiresInDays: -2 }],
    barcodes: [{ code: "7891098010457", description: "Óleo de Soja 900ml" }],
  },
];

export const mockProducts: Product[] = MOCK_ENTRIES.map((entry, i) => {
  const id = `p${i + 1}`;
  const barcodes: Barcode[] = entry.barcodes.map((b, bi) => ({
    id: `${id}-bc${bi + 1}`,
    code: b.code,
    description: b.description,
    product_id: id,
  }));
  return { id, ...entry.product, barcodes };
});

export const mockBatches: Batch[] = MOCK_ENTRIES.flatMap((entry, pi) =>
  entry.batches.map((b, bi) => ({
    id: `p${pi + 1}-b${bi + 1}`,
    product_id: `p${pi + 1}`,
    quantity: b.quantity,
    expires_on: b.expiresInDays === null ? null : isoDaysFromNow(b.expiresInDays),
  })),
);
