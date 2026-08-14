import type { Meta, StoryObj } from "@storybook/react";
import { Footer } from "./Footer";

const meta: Meta<typeof Footer> = {
  title: "Components/Footer",
  component: Footer,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {
  render: () => (
    <div className="w-96 rounded-lg border border-border">
      <div className="flex h-24 items-center justify-center text-sm text-ink-muted">Page content</div>
      <Footer />
    </div>
  ),
};
