import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { groupAlphabetically, groupByStatus, isVisibleInInventory, matchesScope, matchesSearch, type ListScope } from "shelf-sense-core";
import { useMemo, useState } from "react";
import { ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { ProductRow } from "../components/ProductRow";
import { BlockingError, LoadingState, OfflineWarning } from "../components/ScreenState";
import { AppText, Button, ScopeTile, TextField } from "../components/ui";
import { useEnrichedProducts } from "../hooks/useEnrichedProducts";
import { AppShell } from "../navigation/AppShell";
import type { RootStackParamList } from "../navigation/types";

export function InventoryScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Inventory">) {
  const i18n = useT();
  const store = useEnrichedProducts();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ListScope>("all");
  const [sort, setSort] = useState<"soonest" | "alpha">("soonest");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => store.enrichedProducts.filter(isVisibleInInventory),
    [store.enrichedProducts],
  );
  const filtered = useMemo(
    () => visible.filter((product) => matchesSearch(product, query) && matchesScope(product, scope)),
    [visible, query, scope],
  );
  const sections = useMemo(
    () => (sort === "soonest" ? groupByStatus(filtered, i18n.t) : groupAlphabetically(filtered, i18n.t)).map((group) => ({ ...group, data: group.products })),
    [filtered, sort, i18n],
  );
  const attention = visible.filter((product) => product.status === "expired" || product.status === "expiring-soon").length;
  const low = visible.filter((product) => product.isLow).length;

  if (store.loading && !store.hasData) return <AppShell active="Inventory" navigation={navigation}><LoadingState label={i18n.t("inventory.loading")} /></AppShell>;
  if (!store.hasData && store.error) return <AppShell active="Inventory" navigation={navigation}><BlockingError title={i18n.t("inventory.loadError")} message={i18n.t(store.error)} onRetry={store.refetch} /></AppShell>;

  return (
    <AppShell active="Inventory" navigation={navigation}>
      <SectionList
        sections={sections}
        keyExtractor={(product) => product.id}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            {store.offline ? <OfflineWarning onRetry={store.refetch} /> : null}
            <View style={styles.headingRow}><AppText style={styles.heading}>{i18n.t("menu.inventory")}</AppText><Button label={i18n.t("inventory.addButton")} onPress={() => navigation.navigate("BarcodeScan", { from: "Inventory" })} /></View>
            <TextField label={i18n.t("inventory.searchPlaceholder")} value={query} onChangeText={setQuery} placeholder={i18n.t("inventory.searchPlaceholder")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopes}>
              <ScopeTile label={i18n.t("inventory.scopeAllItems")} value={String(visible.length)} selected={scope === "all"} onPress={() => setScope("all")} />
              <ScopeTile label={i18n.t("inventory.scopeAttention")} value={String(attention)} selected={scope === "attention"} onPress={() => setScope("attention")} />
              <ScopeTile label={i18n.t("inventory.scopeLowStock")} value={String(low)} selected={scope === "low"} onPress={() => setScope("low")} />
            </ScrollView>
            <View style={styles.sortRow}><AppText>{i18n.tPlural("inventory.count", filtered.length)}</AppText><Button variant="secondary" label={sort === "soonest" ? i18n.t("inventory.sortSoonest") : i18n.t("inventory.sortAlpha")} onPress={() => setSort((value) => value === "soonest" ? "alpha" : "soonest")} /></View>
          </View>
        )}
        renderSectionHeader={({ section }) => <View style={styles.section}><AppText style={styles.sectionTitle}>{section.label}</AppText><AppText mono>{section.count}</AppText></View>}
        renderItem={({ item }) => <ProductRow product={item} expanded={expanded.has(item.id)} onToggle={() => setExpanded((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} onLongPress={() => navigation.navigate("QuickEdit", { from: "Inventory", productId: item.id })} onEdit={() => navigation.navigate("ProductEdit", { from: "Inventory", productId: item.id })} swipeEnabled />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View style={styles.empty}><AppText style={styles.emptyTitle}>{query || scope !== "all" ? i18n.t("inventory.emptyNothingMatches") : i18n.t("inventory.emptyPantryEmpty")}</AppText><AppText>{query || scope !== "all" ? i18n.t("inventory.emptyClearFiltersHint") : i18n.t("inventory.emptyAddFirstHint")}</AppText>{query || scope !== "all" ? <Button label={i18n.t("inventory.clearFilters")} variant="secondary" onPress={() => { setQuery(""); setScope("all"); }} /> : <Button label={i18n.t("inventory.addFirstProduct")} onPress={() => navigation.navigate("BarcodeScan", { from: "Inventory" })} />}</View>}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 48 }, header: { gap: 16, marginBottom: 20 }, headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heading: { fontSize: 28, fontWeight: "600" }, scopes: { gap: 8 }, sortRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, section: { minHeight: 44, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { fontSize: 16, fontWeight: "600" }, separator: { height: 8 }, empty: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, emptyTitle: { fontSize: 20, fontWeight: "600" } });
