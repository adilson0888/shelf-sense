import type { Config } from "tailwindcss";
import { shelfSensePreset } from "./tailwind.preset";

export default {
  presets: [shelfSensePreset],
  content: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
} satisfies Config;
