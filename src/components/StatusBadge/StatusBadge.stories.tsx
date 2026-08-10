import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    status: { control: "select", options: ["in-stock", "low", "out", "incoming"] },
  },
};
export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const InStock: Story = { args: { status: "in-stock" } };
export const Low: Story = { args: { status: "low" } };
export const Out: Story = { args: { status: "out" } };
export const Incoming: Story = { args: { status: "incoming" } };

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <StatusBadge status="in-stock" />
      <StatusBadge status="low" />
      <StatusBadge status="out" />
      <StatusBadge status="incoming" />
    </div>
  ),
};

export const CustomLabel: Story = {
  args: { status: "low", label: "3 units left" },
};
