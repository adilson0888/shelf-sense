import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "outline", "ghost", "danger", "confirm"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Add to shelf" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Save draft" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Cancel" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Remove item" },
};

export const Confirm: Story = {
  args: { variant: "confirm", children: "Confirm?" },
};

export const Loading: Story = {
  args: { variant: "primary", loading: true, children: "Recording count…" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="confirm">Confirm?</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
