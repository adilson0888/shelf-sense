import type { Meta, StoryObj } from "@storybook/react";
import { IconButton } from "./IconButton";

const meta: Meta<typeof IconButton> = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Hamburger: Story = {
  args: { icon: "☰", "aria-label": "Open navigation", size: "lg" },
};

export const Close: Story = {
  args: { icon: "✕", "aria-label": "Close navigation", size: "sm" },
};

export const ThemeToggle: Story = {
  args: { icon: "☾", "aria-label": "Switch to light theme", size: "md" },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <IconButton icon="☰" aria-label="Small" size="sm" />
      <IconButton icon="☰" aria-label="Medium" size="md" />
      <IconButton icon="☰" aria-label="Large" size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { icon: "☰", "aria-label": "Open navigation", size: "lg", disabled: true },
};
