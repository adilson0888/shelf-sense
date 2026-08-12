// Menu.md's Data section — the app's flat, ungrouped list of navigable
// sections. Icons are plain text/emoji glyphs, not an icon library.
export interface MenuItem {
  key: string;
  label: string;
  route: string;
  icon: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { key: "products", label: "Products", route: "/", icon: "▤" },
  { key: "settings", label: "Settings", route: "/settings", icon: "⚙" },
];
