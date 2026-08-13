import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { NavDrawer, type NavDrawerItem } from "./NavDrawer";
import { IconButton } from "../IconButton/IconButton";
import { Button } from "../Button/Button";

const meta: Meta<typeof NavDrawer> = {
  title: "Components/NavDrawer",
  component: NavDrawer,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof NavDrawer>;

function DemoHeader() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-sm">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-brand-600 text-lg text-ink-inverse">
        🧭
      </div>
      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className="flex items-baseline font-mono text-[17px] tracking-[-0.01em] text-ink-primary">
          <span className="font-semibold">shelf</span>
          <span className="mx-[3px] inline-block h-[5px] w-[5px] rounded-full bg-brand-600" aria-hidden="true" />
          <span className="font-medium text-brand-600">sense</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Personal inventory</span>
      </div>
    </div>
  );
}

export const Open: Story = {
  render: () => {
    const [activeKey, setActiveKey] = useState("products");
    const items: NavDrawerItem[] = [
      { key: "products", label: "Products", icon: "▤", active: activeKey === "products", onSelect: () => setActiveKey("products") },
      { key: "settings", label: "Settings", icon: "⚙", active: activeKey === "settings", onSelect: () => setActiveKey("settings") },
    ];
    return (
      <div className="flex h-[420px] items-center justify-center bg-surface-1 text-sm text-ink-muted">
        Page content behind the drawer
        <NavDrawer
          open
          onClose={() => {}}
          header={<DemoHeader />}
          items={items}
          footer={
            <div className="flex items-center justify-between gap-sm">
              <span className="text-[13px] font-semibold text-ink-secondary">Theme</span>
              <IconButton icon="☾" aria-label="Switch to light theme" />
            </div>
          }
        />
      </div>
    );
  },
};

export const Closed: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const items: NavDrawerItem[] = [
      { key: "products", label: "Products", icon: "▤", active: true, onSelect: () => {} },
      { key: "settings", label: "Settings", icon: "⚙", active: false, onSelect: () => {} },
    ];
    return (
      <>
        <Button size="sm" onClick={() => setOpen(true)}>
          Open navigation
        </Button>
        <NavDrawer open={open} onClose={() => setOpen(false)} header={<DemoHeader />} items={items} />
      </>
    );
  },
};

export const NoFooter: Story = {
  render: () => {
    const items: NavDrawerItem[] = [
      { key: "products", label: "Products", icon: "▤", active: true, onSelect: () => {} },
      { key: "settings", label: "Settings", icon: "⚙", active: false, onSelect: () => {} },
    ];
    return (
      <div className="flex h-[420px] items-center justify-center bg-surface-1 text-sm text-ink-muted">
        Page content behind the drawer
        <NavDrawer open onClose={() => {}} header={<DemoHeader />} items={items} />
      </div>
    );
  },
};
