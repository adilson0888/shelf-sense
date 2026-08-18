import { enrichProduct, type InventoryDefaults } from "shelf-sense-core";
import { useMemo } from "react";
import { useT } from "shelf-sense-i18n/react";
import { usePreferences } from "../providers/PreferencesProvider";
import { useProducts } from "../providers/ProductsProvider";

export function useEnrichedProducts() {
  const store = useProducts();
  const { preferences } = usePreferences();
  const i18n = useT();
  const defaults: InventoryDefaults = useMemo(
    () => ({
      freshnessThresholdDays: preferences.default_freshness_threshold_days,
      minimalQuantity: preferences.default_minimal_quantity,
      minimalPercentage: preferences.default_minimal_percentage,
    }),
    [preferences],
  );
  const products = useMemo(
    () => store.products.map((product) => enrichProduct(product, store.batches, new Date(), defaults, i18n)),
    [store.products, store.batches, defaults, i18n],
  );
  return { ...store, enrichedProducts: products, defaults };
}
