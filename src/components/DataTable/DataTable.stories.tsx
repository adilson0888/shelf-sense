import type { Meta, StoryObj } from "@storybook/react";
import { DataTable } from "./DataTable";
import { StatusBadge, type StockStatus } from "../StatusBadge/StatusBadge";

interface ShelfRow {
  sku: string;
  name: string;
  aisle: string;
  units: number;
  status: StockStatus;
}

const rows: ShelfRow[] = [
  { sku: "SS-10234", name: "Organic Rolled Oats, 32oz", aisle: "4B2", units: 6, status: "low" },
  { sku: "SS-10891", name: "Sparkling Water, 12pk", aisle: "2A1", units: 84, status: "in-stock" },
  { sku: "SS-11042", name: "Sourdough Loaf", aisle: "3C4", units: 0, status: "out" },
  { sku: "SS-11205", name: "Free-range Eggs, dozen", aisle: "2B3", units: 40, status: "incoming" },
];

const meta: Meta<typeof DataTable<ShelfRow>> = {
  title: "Components/DataTable",
  component: DataTable,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof DataTable<ShelfRow>>;

export const ShelfInventory: Story = {
  args: {
    data: rows,
    getRowKey: (row) => row.sku,
    columns: [
      { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
      { key: "name", header: "Item" , render: (row) => row.name },
      { key: "aisle", header: "Aisle", render: (row) => row.aisle },
      { key: "units", header: "Units", align: "right", render: (row) => row.units },
      { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    ],
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: [
      { key: "sku", header: "SKU", render: (row: ShelfRow) => row.sku },
      { key: "name", header: "Item", render: (row: ShelfRow) => row.name },
    ],
    emptyState: "No shelves match the current filters.",
  },
};
