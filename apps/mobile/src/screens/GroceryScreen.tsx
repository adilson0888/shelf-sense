import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { groupByGroceryCategory, isGroceryCandidate, isLowStock, isOutOfStockOccasional, matchesGroceryScope, matchesSearch, type GroceryScope } from "shelf-sense-core";
import { useMemo, useState } from "react";
import { ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { ProductRow } from "../components/ProductRow";
import { BlockingError, LoadingState, OfflineWarning } from "../components/ScreenState";
import { AppText, Button, IconButton, ScopeTile, SectionHeader, TextField } from "../components/ui";
import { useEnrichedProducts } from "../hooks/useEnrichedProducts";
import { AppShell } from "../navigation/AppShell";
import type { RootStackParamList } from "../navigation/types";
import { useAppTheme } from "../theme/ThemeProvider";

export function GroceryScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Grocery">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const store = useEnrichedProducts();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<GroceryScope>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const candidates = useMemo(() => store.enrichedProducts.filter((product) => isGroceryCandidate(product, store.defaults)), [store.enrichedProducts, store.defaults]);
  const filtered = useMemo(() => candidates.filter((product) => matchesSearch(product, query) && matchesGroceryScope(product, scope, store.defaults)), [candidates, query, scope, store.defaults]);
  const sections = useMemo(() => groupByGroceryCategory(filtered, store.defaults, i18n.locale, i18n.t).map((group) => ({ ...group, data: group.products })), [filtered, store.defaults, i18n]);
  const low = candidates.filter((product) => isLowStock(product, store.defaults)).length;
  const occasional = candidates.filter((product) => isOutOfStockOccasional(product, store.defaults)).length;
  const hasFilters = query.trim().length > 0 || scope !== "all";

  if (store.loading && !store.hasData) return <AppShell active="Grocery" navigation={navigation}><LoadingState label={i18n.t("groceryList.loading")} /></AppShell>;
  if (!store.hasData && store.error) return <AppShell active="Grocery" navigation={navigation}><BlockingError title={i18n.t("groceryList.loadError")} message={i18n.t(store.error)} onRetry={store.refetch} /></AppShell>;

  return <AppShell active="Grocery" navigation={navigation}><SectionList sections={sections} keyExtractor={(product) => product.id} stickySectionHeadersEnabled contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.header}>
    {store.offline ? <OfflineWarning onRetry={store.refetch} /> : null}
    <AppText style={styles.heading}>{i18n.t("menu.groceryList")}</AppText>
    <View style={[styles.filterCard, { borderColor: theme.colors.border }]}><SectionHeader title={i18n.t("groceryList.searchFiltersHeading")} open={filtersOpen} onToggle={() => setFiltersOpen((value) => !value)} />{filtersOpen ? <View style={styles.filters}><View style={styles.searchRow}><View style={styles.flex}><TextField label={i18n.t("groceryList.searchPlaceholder")} value={query} onChangeText={setQuery} placeholder={i18n.t("groceryList.searchPlaceholder")} /></View><IconButton label={i18n.t("groceryList.scanBarcodeLabel")} icon="⌁" onPress={() => navigation.navigate("BarcodeScan", { from: "Grocery" })} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopes}><ScopeTile label={i18n.t("groceryList.scopeAll")} value={String(candidates.length)} selected={scope === "all"} onPress={() => setScope("all")} /><ScopeTile label={i18n.t("groceryList.scopeLowStock")} value={String(low)} selected={scope === "low"} onPress={() => setScope("low")} /><ScopeTile label={i18n.t("groceryList.scopeOccasional")} value={String(occasional)} selected={scope === "occasional"} onPress={() => setScope("occasional")} /></ScrollView></View> : null}</View>
    <View style={styles.resultRow}><AppText>{i18n.tPlural("groceryList.resultCount", filtered.length)}</AppText>{hasFilters ? <Button label={i18n.t("groceryList.clearFilters")} variant="ghost" onPress={() => { setQuery(""); setScope("all"); }} /> : null}</View>
  </View>} renderSectionHeader={({ section }) => <View style={[styles.section, { backgroundColor: theme.colors.surface0 }]}><AppText style={styles.sectionTitle}>{section.label}</AppText><AppText mono>{section.count}</AppText></View>} renderItem={({ item }) => <ProductRow product={item} expanded={expanded.has(item.id)} onToggle={() => setExpanded((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} onLongPress={() => navigation.navigate("QuickEdit", { from: "Grocery", productId: item.id })} hideStatusWhenEmpty={item.batches.length === 0} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<View style={styles.empty}><AppText style={styles.emptyTitle}>{hasFilters ? i18n.t("groceryList.emptyFilteredTitle") : i18n.t("groceryList.emptyNothingTitle")}</AppText><AppText>{hasFilters ? i18n.t("groceryList.emptyFilteredHint") : i18n.t("groceryList.emptyNothingHint")}</AppText></View>} /></AppShell>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, paddingBottom: 48 }, header: { gap: 16, marginBottom: 12 }, heading: { fontSize: 28, fontWeight: "600" }, filterCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, filters: { gap: 14, paddingBottom: 16 }, searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 }, scopes: { gap: 8 }, resultRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, section: { minHeight: 44, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { fontSize: 16, fontWeight: "600" }, separator: { height: 8 }, empty: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, emptyTitle: { fontSize: 20, fontWeight: "600" } });
