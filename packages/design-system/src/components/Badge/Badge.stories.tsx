import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["neutral", "success", "warning", "danger", "info"] },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Neutral: Story = { args: { variant: "neutral", children: "Aisle 4" } };
export const Info: Story = { args: { variant: "info", children: "New SKU" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};
