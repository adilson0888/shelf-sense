import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from "./Card";
import { Button } from "../Button/Button";
import { StatusBadge } from "../StatusBadge/StatusBadge";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Basic: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Aisle 4 · Shelf B2</CardTitle>
        <StatusBadge status="low" />
      </CardHeader>
      <CardBody>
        <p className="text-sm text-ink-secondary">
          Organic Rolled Oats, 32oz — 6 units remaining. Reorder threshold is 12 units.
        </p>
      </CardBody>
      <CardFooter>
        <Button variant="outline" size="sm">
          View history
        </Button>
        <Button size="sm">Reorder now</Button>
      </CardFooter>
    </Card>
  ),
};
