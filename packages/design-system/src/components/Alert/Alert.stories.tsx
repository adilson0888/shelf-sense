import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./Alert";

const meta: Meta<typeof Alert> = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["success", "warning", "danger", "info"] },
  },
};
export default meta;
type Story = StoryObj<typeof Alert>;

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "12 shelves are below reorder threshold",
    children: "Review the low-stock report to schedule replenishment.",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    title: "Shipment #4021 delayed",
    children: "Expected arrival pushed from Aug 9 to Aug 13.",
  },
};

export const Success: Story = {
  args: { variant: "success", title: "Cycle count completed for Aisle 4" },
};

export const Info: Story = {
  args: { variant: "info", title: "New sensor firmware available for shelf scales." },
};
