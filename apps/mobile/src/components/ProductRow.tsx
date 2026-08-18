import type { EnrichedProduct } from "shelf-sense-core";
import { freshnessBadgeLabel } from "shelf-sense-core";
import { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { useAppTheme } from "../theme/ThemeProvider";
import { AppText, FreshnessBadge } from "./ui";
import { createProductRowInteraction } from "./productRowInteraction";

export function ProductRow({
  product,
  expanded,
  onToggle,
  onLongPress,
  onEdit,
  swipeEnabled = false,
  hideStatusWhenEmpty = false,
}: {
  product: EnrichedProduct;
  expanded: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onEdit?: () => void;
  swipeEnabled?: boolean;
  hideStatusWhenEmpty?: boolean;
}) {
  const { theme } = useAppTheme();
  const i18n = useT();
  const translateX = useRef(new Animated.Value(0)).current;
  const interaction = useRef(createProductRowInteraction(onToggle, onLongPress)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => swipeEnabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-72, Math.min(0, gesture.dx))),
      onPanResponderRelease: (_, gesture) => {
        const reveal = gesture.dx < -40;
        if (reveal) interaction.markGestureCompleted();
        Animated.spring(translateX, { toValue: reveal ? -64 : 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const statusHidden = hideStatusWhenEmpty && product.batches.length === 0;
  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}>
      {swipeEnabled && onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={i18n.t("productList.popoverEditProduct")} onPress={onEdit} style={[styles.editAction, { backgroundColor: theme.colors.brand700 }]}>
          <AppText style={{ color: theme.colors.inkInverse, fontSize: 22 }}>•••</AppText>
        </Pressable>
      ) : null}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          delayLongPress={480}
          onLongPress={interaction.longPress}
          onPress={interaction.press}
          style={[styles.row, { backgroundColor: theme.colors.surface0 }]}
        >
          <View style={styles.flex}>
            <AppText style={styles.name}>{product.short_description}</AppText>
            <AppText style={{ color: theme.colors.inkSecondary }}>
              {product.tracking_mode === "percentage" ? `${product.stock_percent ?? 0}% · ${i18n.t("inventory.percentTrackedMeta")}` : i18n.tPlural("inventory.count", product.totalQty, { count: product.totalQty })}
            </AppText>
          </View>
          {!statusHidden ? <FreshnessBadge status={product.status} label={freshnessBadgeLabel(product.status, i18n.t)} /> : null}
          {!statusHidden ? <AppText>{expanded ? "⌃" : "⌄"}</AppText> : null}
        </Pressable>
      </Animated.View>
      {expanded ? (
        <View style={[styles.details, { borderTopColor: theme.colors.border }]}>
          {product.tracking_mode === "percentage" ? <AppText style={{ color: theme.colors.inkSecondary }}>{i18n.t("inventory.percentTrackedExpandNote")}</AppText> : product.batches.map((batch) => (
            <View key={batch.id} style={styles.batch}>
              <AppText mono>{batch.qtyLabel}</AppText>
              <AppText style={[styles.flex, { color: theme.colors.inkSecondary }]}>{batch.expiryLabel}</AppText>
              <FreshnessBadge status={batch.status} label={freshnessBadgeLabel(batch.status, i18n.t)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { borderWidth: 1, borderRadius: 12, overflow: "hidden" }, row: { minHeight: 72, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, name: { fontSize: 16, fontWeight: "600", marginBottom: 4 }, details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 }, batch: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8 }, editAction: { position: "absolute", right: 0, top: 0, bottom: 0, width: 64, alignItems: "center", justifyContent: "center" },
});
