import Svg, { Circle, Rect } from "react-native-svg";
import { useAppTheme } from "../theme/ThemeProvider";

export function ToteMark({ size = 48 }: { size?: number }) {
  const { theme } = useAppTheme();
  if (theme.dark) {
    return (
      <Svg accessibilityLabel="ShelfSense" width={size} height={size} viewBox="0 0 64 64">
        <Rect x="14" y="20" width="36" height="30" rx="8" fill="#167d76" />
        <Rect x="14" y="20" width="36" height="8" rx="4" fill="#219c93" />
        <Rect x="7" y="31" width="7" height="6" rx="3" fill="#219c93" />
        <Rect x="50" y="31" width="7" height="6" rx="3" fill="#219c93" />
        <Circle cx="25" cy="37" r="3.6" fill="#ffffff" />
        <Circle cx="39" cy="37" r="3.6" fill="#ffffff" />
        <Rect x="27" y="44" width="10" height="3" rx="1.5" fill="#ffffff" />
      </Svg>
    );
  }
  return (
    <Svg accessibilityLabel="ShelfSense" width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="14" fill="#167d76" />
      <Rect x="14" y="20" width="36" height="30" rx="8" fill="#ffffff" />
      <Rect x="14" y="20" width="36" height="8" rx="4" fill="#a8e8e3" />
      <Rect x="7" y="31" width="7" height="6" rx="3" fill="#a8e8e3" />
      <Rect x="50" y="31" width="7" height="6" rx="3" fill="#a8e8e3" />
      <Circle cx="25" cy="37" r="3.6" fill="#167d76" />
      <Circle cx="39" cy="37" r="3.6" fill="#167d76" />
      <Rect x="27" y="44" width="10" height="3" rx="1.5" fill="#167d76" />
    </Svg>
  );
}
