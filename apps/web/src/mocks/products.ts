import type { Batch, Product } from "../types";

/**
 * Placeholder data standing in for apps/api's future /products endpoint —
 * see Product List.md's Non-functional section (offline caching / real
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
  product: Omit<Product, "id">;
  batches: { quantity: number; expiresInDays: number | null }[];
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
      barcodes: [],
    },
    batches: [
      { quantity: 2, expiresInDays: 2 },
      { quantity: 3, expiresInDays: 41 },
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
      barcodes: [],
    },
    batches: [{ quantity: 5, expiresInDays: null }],
  },
  {
    product: {
      short_description: "Canned Black Beans",
      long_description: "Feijão preto em lata, pronto para consumo",
      aliases: ["feijao preto lata"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      barcodes: [],
    },
    batches: [
      { quantity: 1, expiresInDays: -26 },
      { quantity: 4, expiresInDays: 153 },
    ],
  },
  {
    product: {
      short_description: "Toilet Paper",
      long_description: "Papel higiênico folha dupla, pacote",
      aliases: ["papel higienico"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: false,
      barcodes: [],
    },
    batches: [{ quantity: 12, expiresInDays: null }],
  },
  {
    product: {
      short_description: "Cottage Cheese",
      long_description: "Requeijão cremoso, pote",
      aliases: ["requeijao"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      barcodes: [],
    },
    batches: [{ quantity: 1, expiresInDays: 1 }],
  },
  {
    product: {
      short_description: "Canned Corn",
      long_description: "Milho verde em conserva, lata",
      aliases: ["milho lata"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      barcodes: [],
    },
    batches: [
      { quantity: 2, expiresInDays: -1 },
      { quantity: 1, expiresInDays: 4 },
    ],
  },
  {
    product: {
      short_description: "Baby Carrots",
      long_description: "Cenoura baby, saco",
      aliases: ["cenoura"],
      freshness_threshold_days: null,
      minimal_quantity: null,
      does_expire: true,
      barcodes: [],
    },
    batches: [{ quantity: 1, expiresInDays: -2 }],
  },
];

export const mockProducts: Product[] = MOCK_ENTRIES.map((entry, i) => ({
  id: `p${i + 1}`,
  ...entry.product,
}));

export const mockBatches: Batch[] = MOCK_ENTRIES.flatMap((entry, pi) =>
  entry.batches.map((b, bi) => ({
    id: `p${pi + 1}-b${bi + 1}`,
    product_id: `p${pi + 1}`,
    quantity: b.quantity,
    expires_on: b.expiresInDays === null ? null : isoDaysFromNow(b.expiresInDays),
  })),
);
