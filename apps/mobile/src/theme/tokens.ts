export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const;
export const fonts = { sans: "Inter_400Regular", sansMedium: "Inter_600SemiBold", mono: "IBMPlexMono_500Medium" } as const;

const brand = {
  brand50: "#eefbfa",
  brand100: "#d3f4f1",
  brand200: "#a8e8e3",
  brand300: "#72d5cd",
  brand400: "#3fb9b0",
  brand500: "#219c93",
  brand600: "#167d76",
  brand700: "#14655f",
  brand800: "#14504c",
  brand900: "#134441",
} as const;

export const lightColors = {
  ...brand,
  surface0: "#ffffff",
  surface1: "#f7f8f8",
  surface2: "#eef0f1",
  surface3: "#e2e5e7",
  inkPrimary: "#14181b",
  inkSecondary: "#454c52",
  inkMuted: "#767f86",
  inkInverse: "#ffffff",
  border: "#dfe3e6",
  borderStrong: "#c3c9cd",
  success: "#157f4a",
  successBg: "#e4f6ec",
  warning: "#a15c00",
  warningBg: "#fdf1dc",
  danger: "#b3261e",
  dangerBg: "#fbe7e6",
  info: "#3452b4",
  infoBg: "#e8ecfa",
  freshnessFresh: "#157f4a",
  freshnessFreshBg: "#e4f6ec",
  freshnessSoon: "#a15c00",
  freshnessSoonBg: "#fdf1dc",
  freshnessExpired: "#b3261e",
  freshnessExpiredBg: "#fbe7e6",
  freshnessNone: "#767f86",
  freshnessNoneBg: "#eef0f1",
} as const;

export const darkColors: ThemeColors = {
  ...brand,
  surface0: "#14181b",
  surface1: "#1b2024",
  surface2: "#23292e",
  surface3: "#2d353b",
  inkPrimary: "#f4f6f7",
  inkSecondary: "#c3cbd1",
  inkMuted: "#8b959c",
  inkInverse: "#14181b",
  border: "#2d353b",
  borderStrong: "#3c464d",
  success: "#4ade8a",
  successBg: "#113325",
  warning: "#f3b54c",
  warningBg: "#362a10",
  danger: "#f38b85",
  dangerBg: "#3a1815",
  info: "#93a8f0",
  infoBg: "#1b2140",
  freshnessFresh: "#4ade8a",
  freshnessFreshBg: "#113325",
  freshnessSoon: "#f3b54c",
  freshnessSoonBg: "#362a10",
  freshnessExpired: "#f38b85",
  freshnessExpiredBg: "#3a1815",
  freshnessNone: "#8b959c",
  freshnessNoneBg: "#23292e",
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };
export interface AppTheme {
  mode: "light" | "dark";
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fonts;
}

export const lightTheme: AppTheme = { mode: "light", dark: false, colors: lightColors, spacing, radii, fonts };
export const darkTheme: AppTheme = { mode: "dark", dark: true, colors: darkColors, spacing, radii, fonts };
