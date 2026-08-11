import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./Switch";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const On: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    return <Switch label="Does it expire?" checked={checked} onCheckedChange={setChecked} />;
  },
};

export const Off: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return <Switch label="Does it expire?" checked={checked} onCheckedChange={setChecked} />;
  },
};

export const Disabled: Story = {
  render: () => <Switch label="Does it expire?" checked disabled onCheckedChange={() => {}} />,
};
