import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppLocaleProvider } from "./lib/AppLocaleProvider";
import { PreferencesProvider } from "./lib/preferencesStore";
import { ProductsProvider } from "./lib/productsStore";
import { AddProductPage } from "./pages/AddProduct";
import { InventoryPage } from "./pages/Inventory";
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
        <Route path="/" element={<InventoryPage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <PreferencesProvider>
      <AppLocaleProvider>
        <ProductsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/products/:id/stock" element={<StockEditPage />} />
              {/* specs/Barcode Scanner & Product info scrape.md — the real
                  route the old fifth Add Product modal step became. Same
                  chrome-less-outside-AppShell treatment as Stock Edit, for
                  the same reason: a focused entry screen with unsaved
                  pending state shouldn't invite navigating away via the
                  drawer. */}
              <Route path="/products/add" element={<AddProductPage />} />
              <Route path="/*" element={<ShellRoutes />} />
            </Routes>
          </BrowserRouter>
        </ProductsProvider>
      </AppLocaleProvider>
    </PreferencesProvider>
  );
}
