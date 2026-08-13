import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProductsProvider } from "./lib/productsStore";
import { ProductListPage } from "./pages/ProductList";
import { SettingsPage } from "./pages/Settings";
import { StockEditPage } from "./pages/StockEdit";

// Stock Edit (like Product Edit) is deliberately NOT wrapped in AppShell —
// see Stock Edit.md's UI requirements for why (no hamburger/drawer on a
// focused edit screen with unsaved pending state; AppShell's title logic
// has no way to represent a per-product route). Nested inside its own
// <Routes> so it can sit outside AppShell's chrome while / and /settings
// stay inside it.
function ShellRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ProductListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <ProductsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/products/:id/stock" element={<StockEditPage />} />
          <Route path="/*" element={<ShellRoutes />} />
        </Routes>
      </BrowserRouter>
    </ProductsProvider>
  );
}
