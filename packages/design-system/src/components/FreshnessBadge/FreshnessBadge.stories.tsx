import type { Meta, StoryObj } from "@storybook/react";
import { FreshnessBadge } from "./FreshnessBadge";

const meta: Meta<typeof FreshnessBadge> = {
  title: "Components/FreshnessBadge",
  component: FreshnessBadge,
  tags: ["autodocs"],
  argTypes: {
    status: { control: "select", options: ["fresh", "expiring-soon", "expired", "no-expiration"] },
  },
};
export default meta;
type Story = StoryObj<typeof FreshnessBadge>;

export const Fresh: Story = { args: { status: "fresh" } };
export const ExpiringSoon: Story = { args: { status: "expiring-soon" } };
export const Expired: Story = { args: { status: "expired" } };
export const NoExpiration: Story = { args: { status: "no-expiration" } };

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <FreshnessBadge status="fresh" />
      <FreshnessBadge status="expiring-soon" />
      <FreshnessBadge status="expired" />
      <FreshnessBadge status="no-expiration" />
    </div>
  ),
};

export const CustomLabel: Story = {
  args: { status: "expiring-soon", label: "2 days left" },
};
