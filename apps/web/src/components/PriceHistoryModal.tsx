import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, cn, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, StatCard } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { computeVisibleStats, type PriceSeries } from "../lib/priceHistory";
import type { Product } from "../types";

export interface PriceHistoryModalProps {
  open: boolean;
  /** The product this history belongs to — null while closed, or if the product's gone. */
  product: Product | null;
  series: PriceSeries[];
  visibleKeys: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  onToggleSeries: (key: string) => void;
  onClose: () => void;
  onJumpToQuickBatchEdit: () => void;
}

// packages/design-system/README.md's Charts section — cycle back to
// --ss-chart-1 past 6 series. Assigned by index across ALL series (not
// just visible ones) so a toggled-off line keeps its color if toggled
// back on, rather than reshuffling every other line's color too.
const CHART_COLOR_VARS = ["--ss-chart-1", "--ss-chart-2", "--ss-chart-3", "--ss-chart-4", "--ss-chart-5", "--ss-chart-6"];

interface ChartPoint {
  t: number; // ms epoch — the X axis value; recharts needs a numeric domain, not a date string
  price: number;
  dateLabel: string;
}

/**
 * specs/Price History.md. Purely presentational, same convention as
 * QuickBatchEditModal.tsx — the owning page (ProductList.tsx/Inventory.tsx,
 * via usePriceHistory.ts) holds every piece of state passed in here. The
 * one exception is legend-toggle visibility, which usePriceHistory.ts
 * itself owns rather than the page — see that file's own comment on why.
 *
 * Prototyped in Claude Design first (templates/price-history/ in the
 * synced shelf-sense-ds project) — that prototype is the visual reference
 * this was translated from, same as QuickBatchEditModal's own history.
 */
export function PriceHistoryModal({
  open,
  product,
  series,
  visibleKeys,
  loading,
  error,
  onToggleSeries,
  onClose,
  onJumpToQuickBatchEdit,
}: PriceHistoryModalProps) {
  const { t, formatNumber, formatDate } = useT();

  const hasAnyPricedData = series.length > 0;
  const stats = useMemo(() => computeVisibleStats(series, visibleKeys), [series, visibleKeys]);

  const chartSeries = useMemo(
    () =>
      series.map((s, i) => ({
        key: s.key,
        label: s.label,
        color: `var(${CHART_COLOR_VARS[i % CHART_COLOR_VARS.length]})`,
        visible: visibleKeys.has(s.key),
        points: s.points.map(
          (p): ChartPoint => ({
            t: new Date(p.createdAt).getTime(),
            price: p.price,
            dateLabel: formatDate(p.createdAt.slice(0, 10), { month: "short", day: "numeric" }),
          }),
        ),
      })),
    [series, visibleKeys, formatDate],
  );

  const visibleChartSeries = chartSeries.filter((s) => s.visible);
  const hasVisibleData = visibleChartSeries.some((s) => s.points.length > 0);

  const xDomain = useMemo((): [number, number] => {
    const ts = visibleChartSeries.flatMap((s) => s.points.map((p) => p.t));
    if (ts.length === 0) return [0, 1];
    const min = Math.min(...ts);
    const max = Math.max(...ts);
    // A single distinct purchase date would otherwise collapse the X axis
    // to a point — pad a day each side so the chart still has a real span.
    return min === max ? [min - 86400000, max + 86400000] : [min, max];
  }, [visibleChartSeries]);

  // 3 labeled Y ticks (highest/midpoint/lowest of the visible data), per
  // specs/Price History.md — deduped so a single-price dataset (min===max)
  // doesn't render 3 overlapping identical ticks.
  const yTicks = useMemo(() => {
    if (!stats) return [];
    return Array.from(new Set([stats.max, (stats.min + stats.max) / 2, stats.min]));
  }, [stats]);

  function formatPrice(n: number) {
    return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <Modal open={open} onClose={onClose} aria-label={t("priceHistory.ariaLabel")} className="max-w-lg">
      <ModalHeader>
        <ModalTitle>{product?.short_description ?? ""}</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex max-h-[70vh] flex-col gap-md overflow-y-auto">
        {loading && <p className="text-sm text-ink-muted">{t("priceHistory.loading")}</p>}
        {!loading && error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && !hasAnyPricedData && (
          <div className="flex flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-border-strong font-mono text-[13px] text-ink-muted">
              $
            </div>
            <div className="text-[16px] font-semibold">{t("priceHistory.emptyTitle")}</div>
            <div className="max-w-[260px] text-[13px] text-ink-secondary">{t("priceHistory.emptyHint")}</div>
          </div>
        )}

        {!loading && !error && hasAnyPricedData && (
          <>
            {stats ? (
              <div className="flex gap-sm">
                <StatCard className="flex-1" label={t("priceHistory.highestLabel")} value={formatPrice(stats.max)} />
                <StatCard className="flex-1" label={t("priceHistory.averageLabel")} value={formatPrice(stats.avg)} />
                <StatCard className="flex-1" label={t("priceHistory.lowestLabel")} value={formatPrice(stats.min)} />
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface-1 px-md py-sm text-center text-xs text-ink-muted">
                {t("priceHistory.toggleHint")}
              </div>
            )}

            {hasVisibleData ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="var(--ss-border-strong)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={xDomain}
                      tickFormatter={(v: number) => formatDate(new Date(v).toISOString().slice(0, 10), { month: "short" })}
                      tick={{ fontFamily: "var(--ss-font-mono)", fontSize: 11, fill: "var(--ss-ink-muted)" }}
                      axisLine={{ stroke: "var(--ss-border-strong)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      ticks={yTicks}
                      tickFormatter={(v: number) => formatPrice(v)}
                      tick={{ fontFamily: "var(--ss-font-mono)", fontSize: 11, fill: "var(--ss-ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    {stats && <ReferenceLine y={stats.avg} stroke="var(--ss-border-strong)" strokeWidth={1.5} strokeDasharray="4 4" />}
                    {/* recharts' Tooltip content-prop typing is a verbose generic
                        that adds little safety here — typed loosely on purpose,
                        same trade-off any third-party render-prop callback makes. */}
                    <Tooltip
                      cursor={false}
                      content={(props: any) => {
                        if (!props.active || !props.payload?.length) return null;
                        const point = props.payload[0].payload as ChartPoint;
                        const color = props.payload[0].color as string;
                        return (
                          <div className="flex items-center gap-xs rounded-sm bg-ink-primary px-sm py-1 font-mono text-[11px] text-ink-inverse shadow-md">
                            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
                            <span>
                              {point.dateLabel} · {formatPrice(point.price)}
                            </span>
                          </div>
                        );
                      }}
                    />
                    {visibleChartSeries.map((s) => (
                      <Line
                        key={s.key}
                        data={s.points}
                        dataKey="price"
                        name={s.label}
                        type="monotone"
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-1 font-mono text-xs text-ink-muted">
                {t("priceHistory.noLinesSelected")}
              </div>
            )}

            <div className="flex flex-wrap gap-xs">
              {chartSeries.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onToggleSeries(s.key)}
                  className={cn(
                    "flex items-center gap-xs rounded-full border border-border bg-surface-1 px-sm py-xs text-xs text-ink-secondary",
                    !s.visible && "opacity-45",
                  )}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.visible ? s.color : "var(--ss-border-strong)" }} />
                  <span className={cn(!s.visible && "line-through")}>{s.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onJumpToQuickBatchEdit}>
          {t("priceHistory.jumpToQuickBatchEdit")}
        </Button>
        <Button size="sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
