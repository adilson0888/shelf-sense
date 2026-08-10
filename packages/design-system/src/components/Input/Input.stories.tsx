import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "SKU", placeholder: "e.g. SS-10234" },
};

export const WithHint: Story = {
  args: { label: "Reorder threshold", hint: "Units remaining that trigger a low-stock alert.", type: "number" },
};

export const WithError: Story = {
  args: { label: "Quantity", value: "-4", error: "Quantity can't be negative." },
};

export const Disabled: Story = {
  args: { label: "Barcode", value: "0 41220 12345 6", disabled: true },
};
