export interface ProductRowInteraction {
  press: () => void;
  longPress: () => void;
  markGestureCompleted: () => void;
}

export function createProductRowInteraction(onToggle: () => void, onLongPress: () => void): ProductRowInteraction {
  let suppressNextPress = false;
  return {
    press() {
      if (suppressNextPress) {
        suppressNextPress = false;
        return;
      }
      onToggle();
    },
    longPress() {
      suppressNextPress = true;
      onLongPress();
    },
    markGestureCompleted() {
      suppressNextPress = true;
    },
  };
}
