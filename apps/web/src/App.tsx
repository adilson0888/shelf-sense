import { StatCard, Button } from "shelf-sense-ds";

/**
 * Walking skeleton — proves the wiring works (workspace dependency, real
 * component bundle, real styles.css) end to end. Not a real screen yet.
 * The first real screen should come from a spec in /specs, not from
 * growing this file organically.
 */
export function App() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "var(--ss-font-sans)" }}>ShelfSense</h1>
      <p style={{ color: "var(--ss-ink-secondary)" }}>
        apps/web wired to shelf-sense-ds — replace this page once the first spec lands.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        <StatCard label="Total SKUs tracked" value="2,481" />
        <StatCard label="Low-stock alerts" value="12" delta="+5 vs yesterday" trend="down" />
        <StatCard label="Sell-through rate" value="94%" delta="+3.2% vs last week" trend="up" />
      </div>
      <div style={{ marginTop: 24 }}>
        <Button>It builds!</Button>
      </div>
    </main>
  );
}
