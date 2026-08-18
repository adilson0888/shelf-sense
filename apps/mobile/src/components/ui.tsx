import type { FreshnessStatus } from "shelf-sense-core";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

export function AppText({ style, children, mono = false, ...props }: TextProps & { mono?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <Text
      {...props}
      style={[{ color: theme.colors.inkPrimary, fontFamily: mono ? theme.fonts.mono : theme.fonts.sans }, style]}
    >
      {children}
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = "primary", disabled = false, style }: ButtonProps) {
  const { theme } = useAppTheme();
  const background =
    variant === "primary"
      ? theme.colors.brand600
      : variant === "danger"
        ? theme.colors.danger
        : variant === "secondary"
          ? theme.colors.surface2
          : "transparent";
  const foreground =
    variant === "primary" || variant === "danger" ? theme.colors.inkInverse : theme.colors.inkPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: theme.colors.borderStrong, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 },
        style,
      ]}
    >
      <AppText style={{ color: foreground, fontFamily: theme.fonts.sansMedium }}>{label}</AppText>
    </Pressable>
  );
}

export function IconButton({ label, icon, onPress, disabled = false }: { label: string; icon: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? theme.colors.surface2 : "transparent", opacity: disabled ? 0.4 : 1 }]}
    >
      <AppText style={styles.iconText}>{icon}</AppText>
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  multiline,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.fieldGap}>
      <AppText style={{ color: theme.colors.inkSecondary }}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: theme.colors.inkPrimary, backgroundColor: theme.colors.surface1, borderColor: error ? theme.colors.danger : theme.colors.borderStrong, fontFamily: theme.fonts.sans },
        ]}
      />
      {error ? <AppText style={{ color: theme.colors.danger }}>{error}</AppText> : null}
    </View>
  );
}

export function SwitchField({ label, value, onValueChange, disabled = false }: { label: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.switchRow}>
      <AppText style={styles.flex}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.surface3, true: theme.colors.brand600 }}
        thumbColor={theme.colors.surface0}
      />
    </View>
  );
}

export interface SelectOption<T extends string> { label: string; value: T }

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: SelectOption<T>[]; onChange: (value: T) => void }) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return (
    <View style={styles.fieldGap}>
      <AppText style={{ color: theme.colors.inkSecondary }}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected}`} onPress={() => setOpen(true)} style={[styles.input, styles.select, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface1 }]}>
        <AppText>{selected}</AppText><AppText>⌄</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={[styles.optionSheet, { backgroundColor: theme.colors.surface0 }]}>
            {options.map((option) => (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value }} onPress={() => { onChange(option.value); setOpen(false); }} style={styles.option}>
                <AppText>{option.label}</AppText>
                {option.value === value ? <AppText>✓</AppText> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function AlertBanner({ tone = "info", children, action }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode; action?: ReactNode }) {
  const { theme } = useAppTheme();
  const color = theme.colors[tone];
  const backgroundColor = theme.colors[`${tone}Bg` as "infoBg" | "successBg" | "warningBg" | "dangerBg"];
  return <View accessibilityRole="alert" style={[styles.alert, { borderColor: color, backgroundColor }]}><AppText style={[styles.flex, { color }]}>{children}</AppText>{action}</View>;
}

export function FreshnessBadge({ status, label }: { status: FreshnessStatus; label: string }) {
  const { theme } = useAppTheme();
  const palette = status === "fresh" ? [theme.colors.freshnessFresh, theme.colors.freshnessFreshBg] : status === "expiring-soon" ? [theme.colors.freshnessSoon, theme.colors.freshnessSoonBg] : status === "expired" ? [theme.colors.freshnessExpired, theme.colors.freshnessExpiredBg] : [theme.colors.freshnessNone, theme.colors.freshnessNoneBg];
  return <View style={[styles.badge, { backgroundColor: palette[1] }]}><AppText style={{ color: palette[0], fontFamily: theme.fonts.sansMedium }}>{label}</AppText></View>;
}

export function ScopeTile({ label, value, selected, onPress }: { label: string; value: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.scope, { backgroundColor: selected ? theme.colors.brand600 : theme.colors.surface1, borderColor: selected ? theme.colors.brand600 : theme.colors.border }]}><AppText mono style={{ fontSize: 22, color: selected ? theme.colors.inkInverse : theme.colors.inkPrimary }}>{value}</AppText><AppText style={{ color: selected ? theme.colors.inkInverse : theme.colors.inkSecondary }}>{label}</AppText></Pressable>;
}

export function SectionHeader({ title, open, onToggle, action }: { title: string; open?: boolean; onToggle?: () => void; action?: ReactNode }) {
  return <View style={styles.sectionHeader}>{onToggle ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={[styles.sectionToggle, styles.flex]}><AppText style={styles.sectionTitle}>{title}</AppText><AppText>{open ? "−" : "+"}</AppText></Pressable> : <AppText style={[styles.sectionTitle, styles.flex]}>{title}</AppText>}{action}</View>;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }: { visible: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}><View style={styles.scrim}><View style={[styles.dialog, { backgroundColor: theme.colors.surface0 }]}><AppText style={styles.dialogTitle}>{title}</AppText><AppText style={{ color: theme.colors.inkSecondary }}>{message}</AppText><View style={styles.actions}><Button label={cancelLabel} variant="secondary" onPress={onCancel} /><Button label={confirmLabel} variant={danger ? "danger" : "primary"} onPress={onConfirm} /></View></View></View></Modal>;
}

export function FooterWordmark() {
  const { theme } = useAppTheme();
  return <View style={styles.footer}><AppText mono style={{ color: theme.colors.inkMuted }}>shelf·sense</AppText></View>;
}

export function FullScreenModal({ visible, onRequestClose, children }: { visible: boolean; onRequestClose: () => void; children: ReactNode }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} animationType="slide" onRequestClose={onRequestClose}><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.colors.surface0 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>{children}</ScrollView></View></Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, button: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" }, iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, iconText: { fontSize: 22 }, fieldGap: { gap: 6 }, input: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }, multiline: { minHeight: 88, textAlignVertical: "top" }, switchRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 }, select: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }, optionSheet: { alignSelf: "stretch", borderRadius: 12, padding: 8 }, option: { minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, alert: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }, badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 }, scope: { minWidth: 104, minHeight: 88, borderWidth: 1, borderRadius: 12, padding: 12, justifyContent: "center", gap: 4 }, sectionHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }, sectionToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { fontSize: 18, fontWeight: "600" }, dialog: { width: "100%", maxWidth: 420, borderRadius: 16, padding: 20, gap: 16 }, dialogTitle: { fontSize: 20, fontWeight: "600" }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 }, footer: { paddingVertical: 24, alignItems: "center" }, modalContent: { flexGrow: 1, padding: 16, gap: 16 },
});
