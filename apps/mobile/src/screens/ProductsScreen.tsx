import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { compareByName, effectiveFreshnessThresholdDays, effectiveMinimalPercentage, effectiveMinimalQuantity, matchesExpiryFilter, matchesSearch, matchesTypeFilter, type ExpiryFilter, type Product, type TypeFilter } from "shelf-sense-core";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { BlockingError, LoadingState, OfflineWarning } from "../components/ScreenState";
import { AppText, Button, IconButton, SectionHeader, SelectField, TextField } from "../components/ui";
import { useEnrichedProducts } from "../hooks/useEnrichedProducts";
import { AppShell } from "../navigation/AppShell";
import type { RootStackParamList } from "../navigation/types";
import { useAppTheme } from "../theme/ThemeProvider";

export function ProductsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Products">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const store = useEnrichedProducts();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [actionsFor, setActionsFor] = useState<Product | null>(null);
  const filtered = useMemo(
    () => store.enrichedProducts
      .filter((product) => matchesSearch(product, query) && matchesTypeFilter(product, typeFilter, store.defaults) && matchesExpiryFilter(product, expiryFilter))
      .sort((a, b) => compareByName(a, b, i18n.locale)),
    [store.enrichedProducts, query, typeFilter, expiryFilter, store.defaults, i18n.locale],
  );
  const hasFilters = query.trim().length > 0 || typeFilter !== "all" || expiryFilter !== "all";

  if (store.loading && !store.hasData) return <AppShell active="Products" navigation={navigation}><LoadingState label={i18n.t("productList.loading")} /></AppShell>;
  if (!store.hasData && store.error) return <AppShell active="Products" navigation={navigation}><BlockingError title={i18n.t("productList.loadError")} message={i18n.t(store.error)} onRetry={store.refetch} /></AppShell>;

  return (
    <AppShell active="Products" navigation={navigation}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {store.offline ? <OfflineWarning onRetry={store.refetch} /> : null}
        <View style={styles.headingRow}><AppText style={styles.heading}>{i18n.t("menu.products")}</AppText><Button label={i18n.t("productList.addButton")} onPress={() => navigation.navigate("BarcodeScan", { from: "Products" })} /></View>
        <View style={[styles.filterCard, { borderColor: theme.colors.border }]}>
          <SectionHeader title={i18n.t("productList.searchFiltersHeading")} open={filtersOpen} onToggle={() => setFiltersOpen((value) => !value)} />
          {filtersOpen ? <View style={styles.filters}>
            <TextField label={i18n.t("productList.searchPlaceholder")} value={query} onChangeText={setQuery} placeholder={i18n.t("productList.searchPlaceholder")} />
            <SelectField label={i18n.t("productList.typeFilterLabel")} value={typeFilter} onChange={setTypeFilter} options={[{ value: "all", label: i18n.t("productList.typeAll") }, { value: "regular", label: i18n.t("productList.typeRegular") }, { value: "occasional", label: i18n.t("productList.typeOccasional") }]} />
            <SelectField label={i18n.t("productList.expiryFilterLabel")} value={expiryFilter} onChange={setExpiryFilter} options={[{ value: "all", label: i18n.t("productList.expiryAll") }, { value: "expires", label: i18n.t("productList.expiryExpires") }, { value: "no-expiry", label: i18n.t("productList.expiryDoesnt") }]} />
          </View> : null}
        </View>
        <View style={styles.resultRow}><AppText>{i18n.tPlural("productList.resultCount", filtered.length)}</AppText>{hasFilters ? <Button label={i18n.t("productList.clearFilters")} variant="ghost" onPress={() => { setQuery(""); setTypeFilter("all"); setExpiryFilter("all"); }} /> : null}</View>
        {filtered.length === 0 ? <View style={styles.empty}><AppText style={styles.emptyTitle}>{hasFilters ? i18n.t("productList.emptyFilteredTitle") : i18n.t("productList.emptyNoneTitle")}</AppText><AppText>{hasFilters ? i18n.t("productList.emptyFilteredHint") : i18n.t("productList.emptyNoneHint")}</AppText></View> : (
          <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={i18n.t("menu.products")}>
            <View style={[styles.table, { borderColor: theme.colors.border }]}>
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: theme.colors.surface2 }]}><AppText style={styles.nameCell}>{i18n.t("common.shortDescriptionLabel")}</AppText><AppText style={styles.cell}>{i18n.t("common.freshnessThresholdLabel")}</AppText><AppText style={styles.cell}>{i18n.t("productList.columnMinimumStock")}</AppText><View style={styles.actionCell} /></View>
              {filtered.map((product) => {
                const freshness = effectiveFreshnessThresholdDays(product, store.defaults);
                const minimum = product.tracking_mode === "percentage" ? `${effectiveMinimalPercentage(product, store.defaults)}%` : String(effectiveMinimalQuantity(product, store.defaults));
                return <Pressable key={product.id} delayLongPress={480} onLongPress={() => navigation.navigate("QuickEdit", { from: "Products", productId: product.id })} style={[styles.tableRow, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface0 }]}><AppText style={styles.nameCell}>{product.short_description}</AppText><AppText style={styles.cell}>{freshness === null ? i18n.t("freshness.doesNotExpire") : i18n.tPlural("productList.daysValue", freshness)}</AppText><AppText mono style={styles.cell}>{minimum}</AppText><View style={styles.actionCell}><IconButton label={i18n.t("productList.rowActionsLabel")} icon="⋯" onPress={() => setActionsFor(product)} /></View></Pressable>;
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>
      <Modal visible={Boolean(actionsFor)} transparent animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={styles.scrim} onPress={() => setActionsFor(null)}><View style={[styles.actionMenu, { backgroundColor: theme.colors.surface0 }]}><Button label={i18n.t("productList.popoverEditProduct")} variant="secondary" onPress={() => { if (!actionsFor) return; const id = actionsFor.id; setActionsFor(null); navigation.navigate("ProductEdit", { from: "Products", productId: id }); }} /><Button label={i18n.t("productList.popoverEditStock")} variant="secondary" disabled={actionsFor?.tracking_mode === "percentage"} onPress={() => { if (!actionsFor) return; const id = actionsFor.id; setActionsFor(null); navigation.navigate("StockEdit", { productId: id }); }} /></View></Pressable>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 48, gap: 16 }, headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heading: { fontSize: 28, fontWeight: "600" }, filterCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, filters: { gap: 14, paddingBottom: 16 }, resultRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, table: { minWidth: 760, borderWidth: 1, borderRadius: 12, overflow: "hidden" }, tableRow: { minHeight: 60, flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth }, tableHeader: { borderTopWidth: 0 }, nameCell: { width: 280, paddingHorizontal: 12, fontWeight: "600" }, cell: { width: 190, paddingHorizontal: 12 }, actionCell: { width: 80, alignItems: "center" }, empty: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, emptyTitle: { fontSize: 20, fontWeight: "600" }, scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }, actionMenu: { width: "100%", maxWidth: 360, borderRadius: 12, padding: 12, gap: 8 } });
