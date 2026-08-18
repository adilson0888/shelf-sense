import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "shelf-sense-i18n/react";
import { AlertBanner, AppText, IconButton } from "../components/ui";
import { ToteMark } from "../components/ToteMark";
import { useAppTheme } from "../theme/ThemeProvider";
import type { RootRoute, RootStackParamList } from "./types";
import { useFeedback } from "../providers/FeedbackProvider";

const menuItems: { route: RootRoute; icon: string; key: string }[] = [
  { route: "Inventory", icon: "▤", key: "menu.inventory" },
  { route: "Products", icon: "🗂", key: "menu.products" },
  { route: "Grocery", icon: "🛒", key: "menu.groceryList" },
  { route: "Settings", icon: "⚙", key: "menu.settings" },
];

export function AppShell({ active, navigation, children }: { active: RootRoute; navigation: NativeStackNavigationProp<RootStackParamList, RootRoute>; children: ReactNode }) {
  const { theme, toggleTheme } = useAppTheme();
  const { t } = useT();
  const { message, clearMessage } = useFeedback();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = menuItems.find((item) => item.route === active)?.key ?? "menu.inventory";

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.surface0 }}>
      <View style={[styles.appBar, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface0 }]}>
        <IconButton label={t("appShell.openNavigation")} icon="☰" onPress={() => setDrawerOpen(true)} />
        <AppText style={styles.title}>{t(title)}</AppText>
      </View>
      <View style={styles.content}>{children}</View>
      {message ? <View style={styles.feedback}><Pressable onPress={clearMessage}><AlertBanner tone="success">{message}</AlertBanner></Pressable></View> : null}
      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerLayer}>
          <Pressable accessibilityLabel={t("common.cancel")} style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
          <View style={[styles.drawer, { width: Math.min(288, width * 0.86), paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface0 }]}>
            <View style={styles.drawerHeader}>
              <ToteMark size={48} />
              <View style={styles.flex}>
                <AppText mono style={styles.wordmark}>shelf·sense</AppText>
                <AppText style={{ color: theme.colors.inkSecondary }}>{t("appShell.tagline")}</AppText>
              </View>
              <IconButton label={t("common.cancel")} icon="×" onPress={() => setDrawerOpen(false)} />
            </View>
            <View style={styles.menu}>
              {menuItems.map((item) => {
                const selected = active === item.route;
                return (
                  <Pressable
                    key={item.route}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => { setDrawerOpen(false); navigation.navigate(item.route); }}
                    style={[styles.menuItem, { backgroundColor: selected ? theme.colors.surface2 : "transparent" }]}
                  >
                    <AppText style={styles.menuIcon}>{item.icon}</AppText>
                    <AppText style={[styles.flex, selected && { fontFamily: theme.fonts.sansMedium }]}>{t(item.key)}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityLabel={t(theme.dark ? "appShell.switchToLightTheme" : "appShell.switchToDarkTheme")} accessibilityRole="switch" accessibilityState={{ checked: theme.dark }} onPress={toggleTheme} style={[styles.themeButton, { borderColor: theme.colors.border }]}>
              <AppText>{theme.dark ? "☾" : "☀"}</AppText>
              <AppText style={styles.flex}>{t("appShell.theme")}</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { flex: 1 }, feedback: { position: "absolute", top: 64, left: 12, right: 12, zIndex: 4 }, appBar: { height: 56, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, gap: 8 }, title: { fontSize: 20, fontWeight: "600" }, drawerLayer: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", alignItems: "flex-start" }, drawer: { height: "100%", paddingHorizontal: 16 }, drawerHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }, wordmark: { fontSize: 19 }, menu: { flex: 1, gap: 4 }, menuItem: { minHeight: 52, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 }, menuIcon: { width: 28, fontSize: 20, textAlign: "center" }, themeButton: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 },
});
