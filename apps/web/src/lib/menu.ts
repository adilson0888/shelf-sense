// Menu.md's Data section — the app's flat, ungrouped list of navigable
// sections. Icons are plain text/emoji glyphs, not an icon library.
export interface MenuItem {
  key: string;
  label: string;
  route: string;
  icon: string;
}

// A function, not a static constant — labels must react to locale changes
// at runtime (specs/i18n.md), so this can't be frozen at module-import
// time the way a plain exported array would be. AppShell.tsx (its only
// consumer) calls this inline in its render body via useT().
export function getMenuItems(t: (key: string) => string): MenuItem[] {
  return [
    { key: "inventory", label: t("menu.inventory"), route: "/", icon: "▤" },
    { key: "products", label: t("menu.products"), route: "/products", icon: "🗂" },
    { key: "grocery", label: t("menu.groceryList"), route: "/grocery", icon: "🛒" },
    { key: "settings", label: t("menu.settings"), route: "/settings", icon: "⚙" },
  ];
}
