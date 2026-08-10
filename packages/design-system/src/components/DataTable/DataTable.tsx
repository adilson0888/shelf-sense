import * as React from "react";
import { cn } from "@/lib/cn";

export interface DataTableColumn<T> {
  /** Unique key for the column, also used for React keys. */
  key: string;
  /** Column header text. */
  header: string;
  /** Renders a cell's content for a given row. */
  render: (row: T) => React.ReactNode;
  /** Text alignment. @default "left" */
  align?: "left" | "right" | "center";
  /** Extra classes applied to every cell in this column. */
  className?: string;
}

export interface DataTableProps<T> {
  /** Column definitions, in display order. */
  columns: DataTableColumn<T>[];
  /** Row data. */
  data: T[];
  /** Extracts a stable React key from a row. Defaults to row index. */
  getRowKey?: (row: T, index: number) => React.Key;
  /** Content shown when `data` is empty. */
  emptyState?: React.ReactNode;
  /** Called when a row is clicked; rows become keyboard-focusable buttons when set. */
  onRowClick?: (row: T) => void;
  className?: string;
}

const alignClasses = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Tabular list of rows with typed columns — the primary way to show shelf
 * inventory, SKU lists, or shipment logs. Pair cells with {@link StatusBadge}
 * for stock-state columns.
 */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyState,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-1">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-md py-sm text-xs font-semibold uppercase tracking-wide text-ink-muted",
                  alignClasses[col.align ?? "left"],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-md py-lg text-center text-ink-muted">
                {emptyState ?? "No rows to display."}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, index) : index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border last:border-0",
                  onRowClick && "cursor-pointer hover:bg-surface-1",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-md py-sm text-ink-primary", alignClasses[col.align ?? "left"], col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
