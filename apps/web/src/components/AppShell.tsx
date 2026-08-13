import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconButton, NavDrawer, type NavDrawerItem } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { getMenuItems } from "../lib/menu";
import { useTheme } from "../lib/theme";

export interface AppShellProps {
  children: ReactNode;
}

/**
 * The app-wide chrome from Menu.md: a sticky top app bar (hamburger +
 * current section title) plus the NavDrawer it opens. Wraps every routed
 * page — see App.tsx.
 */
export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();

  const menuItems = getMenuItems(t);
  const activeItem = menuItems.find((item) => item.route === location.pathname) ?? menuItems[0];

  const items: NavDrawerItem[] = menuItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    active: item.key === activeItem.key,
    onSelect: () => {
      navigate(item.route);
      setDrawerOpen(false);
    },
  }));

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-surface-1 font-sans text-ink-primary">
      <div className="sticky top-0 z-[2] flex h-[60px] flex-shrink-0 items-center gap-1 border-b border-border bg-surface-0 px-sm">
        <IconButton icon="☰" aria-label={t("appShell.openNavigation")} size="lg" onClick={() => setDrawerOpen(true)} />
        <h1 className="m-0 flex-1 truncate pl-1 text-[19px] font-bold tracking-[-0.01em]">{activeItem.label}</h1>
      </div>

      <div className="flex flex-1 flex-col">{children}</div>

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        header={
          <div className="flex min-w-0 flex-1 items-center gap-sm">
            {/* Tote (mascot mark), by explicit choice — specs/Brand.md's
                guidelines default to the Ledger mark for "product UI",
                but this app uses Tote here instead.

                Swapped between icon-tote-tile.svg (opaque teal square,
                used in light theme) and icon-tote-mono.svg (no
                background, used in dark theme) rather than one fixed
                asset — the guidelines don't actually define this as a
                light/dark pair (the tile is documented as staying "as-is"
                on dark surfaces; mono is captioned for single-colour
                print), so this is a new rule for this app, not one
                lifted from the source doc. Checked deliberately, not
                assumed: icon-tote-mono.svg's face is drawn in solid
                white with no backing tile, which reads fine floating on
                a dark surface but would go invisible — white-on-white —
                on a light one, so the assignment isn't arbitrary; it's
                the one pairing that stays legible in both themes. See
                specs/Menu.md and specs/Brand.md. */}
            <img
              src={theme === "dark" ? "/brand/icon-tote-mono.svg" : "/brand/icon-tote-tile.svg"}
              alt=""
              className="h-9 w-9 flex-shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="flex items-baseline font-mono text-[17px] tracking-[-0.01em] text-ink-primary">
                <span className="font-semibold">shelf</span>
                <span className="mx-[3px] inline-block h-[5px] w-[5px] rounded-full bg-brand-600" aria-hidden="true" />
                <span className="font-medium text-brand-600">sense</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                {t("appShell.tagline")}
              </span>
            </div>
          </div>
        }
        items={items}
        footer={
          <div className="flex items-center justify-between gap-sm">
            <span className="text-[13px] font-semibold text-ink-secondary">{t("appShell.theme")}</span>
            <IconButton
              icon={theme === "dark" ? "☾" : "☀"}
              aria-label={theme === "dark" ? t("appShell.switchToLightTheme") : t("appShell.switchToDarkTheme")}
              onClick={toggleTheme}
            />
          </div>
        }
      />
    </div>
  );
}
