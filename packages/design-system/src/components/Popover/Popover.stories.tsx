import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { Popover, PopoverItem } from "./Popover";
import { IconButton } from "../IconButton/IconButton";

const meta: Meta<typeof Popover> = {
  title: "Components/Popover",
  component: Popover,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Popover>;

export const RowActionsMenu: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    function openMenu() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ x: Math.max(8, rect.right - 158), y: rect.bottom + 6 });
      setOpen(true);
    }

    return (
      <div className="flex justify-end p-lg">
        <IconButton ref={triggerRef} icon="⋯" aria-label="Row actions" onClick={openMenu} />
        <Popover open={open} onClose={() => setOpen(false)} position={position}>
          <PopoverItem onClick={() => setOpen(false)}>Edit product</PopoverItem>
          <PopoverItem onClick={() => setOpen(false)}>Edit stock</PopoverItem>
        </Popover>
      </div>
    );
  },
};
