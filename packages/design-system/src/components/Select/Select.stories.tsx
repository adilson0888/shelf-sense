import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: "Aisle",
    placeholder: "Select an aisle",
    options: [
      { value: "1", label: "Aisle 1 — Produce" },
      { value: "2", label: "Aisle 2 — Dairy" },
      { value: "3", label: "Aisle 3 — Bakery" },
      { value: "4", label: "Aisle 4 — Dry goods" },
    ],
  },
};
