import type { CSSProperties } from "react";

/**
 * Fires a short vibration on the same tick a hold-to-open gesture actually
 * fires. Kept in one place so every long-press row (Inventory, ProductList,
 * GroceryList) triggers haptic feedback in lockstep with the action it
 * accompanies, rather than relying on the browser/OS's own native long-press
 * haptic, which fires on its own (device-dependent) timer and can land a few
 * milliseconds before our hold threshold.
 */
export function vibrateHold() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

/**
 * Suppresses the browser/OS's native long-press gesture recognition (text-
 * select callout, and the haptic tick bundled with it) on a pressable row.
 * Pair with `vibrateHold()` so haptic feedback only ever fires from our own
 * hold timer, never from the native gesture racing it.
 */
export const suppressNativeLongPressStyle: CSSProperties = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};
