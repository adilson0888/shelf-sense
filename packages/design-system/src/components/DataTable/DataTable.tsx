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
  /**
   * Row-level pointer handlers, passed through verbatim to each row's
   * `<tr>` — an escape hatch for custom press gestures (e.g. long-press to
   * open a quick-edit modal, ShelfSense's own hold pattern) that don't fit
   * `onRowClick`. All independent of `onRowClick` and of each other.
   */
  onRowPointerDown?: (row: T, e: React.PointerEvent<HTMLTableRowElement>) => void;
  onRowPointerMove?: (e: React.PointerEvent<HTMLTableRowElement>) => void;
  onRowPointerUp?: (row: T, e: React.PointerEvent<HTMLTableRowElement>) => void;
  onRowPointerCancel?: () => void;
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
 *
 * Visual language matches the hand-rolled batch table already proven in
 * StockEdit.tsx (mono/tracked/uppercase header on `surface-2`, tight
 * `px-[10px] py-[9px]` cells, `surface-0` body) — this component is what
 * that same look becomes for a plain row-per-record table, rather than a
 * second, independently-drifting style.
 */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyState,
  onRowClick,
  onRowPointerDown,
  onRowPointerMove,
  onRowPointerUp,
  onRowPointerCancel,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface-0", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-[10px] py-[9px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted",
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
                onPointerDown={onRowPointerDown ? (e) => onRowPointerDown(row, e) : undefined}
                onPointerMove={onRowPointerMove}
                onPointerUp={onRowPointerUp ? (e) => onRowPointerUp(row, e) : undefined}
                onPointerCancel={onRowPointerCancel}
                onContextMenu={onRowPointerDown ? (e) => e.preventDefault() : undefined}
                className={cn(
                  "border-t border-border first:border-t-0",
                  (onRowClick || onRowPointerDown) && "cursor-pointer hover:bg-surface-1",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-[10px] py-[9px] text-ink-primary", alignClasses[col.align ?? "left"], col.className)}
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
