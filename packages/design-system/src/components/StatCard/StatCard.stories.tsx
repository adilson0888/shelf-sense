import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Components/StatCard",
  component: StatCard,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: { label: "Total SKUs tracked", value: "2,481" },
};

export const TrendUp: Story = {
  args: { label: "Sell-through rate", value: "94%", delta: "+3.2% vs last week", trend: "up" },
};

export const TrendDown: Story = {
  args: { label: "Shelves below threshold", value: "12", delta: "+5 vs yesterday", trend: "down" },
};

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-md">
      <StatCard label="Total SKUs tracked" value="2,481" />
      <StatCard label="Low-stock alerts" value="12" delta="+5 vs yesterday" trend="down" />
      <StatCard label="Sell-through rate" value="94%" delta="+3.2% vs last week" trend="up" />
    </div>
  ),
};
