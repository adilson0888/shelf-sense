import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          50: "var(--ss-brand-50)",
          100: "var(--ss-brand-100)",
          200: "var(--ss-brand-200)",
          300: "var(--ss-brand-300)",
          400: "var(--ss-brand-400)",
          500: "var(--ss-brand-500)",
          600: "var(--ss-brand-600)",
          700: "var(--ss-brand-700)",
          800: "var(--ss-brand-800)",
          900: "var(--ss-brand-900)",
        },
        // Neutral surface/text scale
        surface: {
          0: "var(--ss-surface-0)",
          1: "var(--ss-surface-1)",
          2: "var(--ss-surface-2)",
          3: "var(--ss-surface-3)",
        },
        ink: {
          primary: "var(--ss-ink-primary)",
          secondary: "var(--ss-ink-secondary)",
          muted: "var(--ss-ink-muted)",
          inverse: "var(--ss-ink-inverse)",
        },
        border: {
          DEFAULT: "var(--ss-border)",
          strong: "var(--ss-border-strong)",
        },
        // Semantic stock-status colors — the core vocabulary of this DS
        stock: {
          "in-stock": "var(--ss-stock-in)",
          "in-stock-bg": "var(--ss-stock-in-bg)",
          low: "var(--ss-stock-low)",
          "low-bg": "var(--ss-stock-low-bg)",
          out: "var(--ss-stock-out)",
          "out-bg": "var(--ss-stock-out-bg)",
          incoming: "var(--ss-stock-incoming)",
          "incoming-bg": "var(--ss-stock-incoming-bg)",
        },
        // Generic semantic (alerts, banners)
        success: { DEFAULT: "var(--ss-success)", bg: "var(--ss-success-bg)" },
        warning: { DEFAULT: "var(--ss-warning)", bg: "var(--ss-warning-bg)" },
        danger: { DEFAULT: "var(--ss-danger)", bg: "var(--ss-danger-bg)" },
        info: { DEFAULT: "var(--ss-info)", bg: "var(--ss-info-bg)" },
      },
      borderRadius: {
        sm: "var(--ss-radius-sm)",
        md: "var(--ss-radius-md)",
        lg: "var(--ss-radius-lg)",
        xl: "var(--ss-radius-xl)",
        full: "var(--ss-radius-full)",
      },
      spacing: {
        xs: "var(--ss-space-xs)",
        sm: "var(--ss-space-sm)",
        md: "var(--ss-space-md)",
        lg: "var(--ss-space-lg)",
        xl: "var(--ss-space-xl)",
        "2xl": "var(--ss-space-2xl)",
      },
      fontFamily: {
        sans: ["var(--ss-font-sans)"],
        mono: ["var(--ss-font-mono)"],
      },
      boxShadow: {
        sm: "var(--ss-shadow-sm)",
        md: "var(--ss-shadow-md)",
        lg: "var(--ss-shadow-lg)",
      },
    },
  },
  plugins: [],
} satisfies Config;
