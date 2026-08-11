import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "./Modal";
import { Button } from "../Button/Button";

const meta: Meta<typeof Modal> = {
  title: "Components/Modal",
  component: Modal,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const MethodChoice: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Add product</Button>
        <Modal open={open} onClose={() => setOpen(false)} aria-label="Add a product">
          <ModalHeader>
            <ModalTitle>Add a product</ModalTitle>
          </ModalHeader>
          <ModalBody className="flex flex-col gap-sm">
            <Button variant="outline">Scan barcode</Button>
            <Button variant="outline">Take a photo</Button>
            <Button variant="outline">Enter manually</Button>
          </ModalBody>
        </Modal>
      </>
    );
  },
};

export const ConfirmWarning: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Add as new
        </Button>
        <Modal open={open} onClose={() => setOpen(false)} aria-label="Move this barcode?">
          <ModalHeader>
            <ModalTitle>Move this barcode?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-ink-secondary">
              This barcode is currently linked to "Queijo Ralado." Continuing will unlink it from that product
              and link it to the new one instead.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Unlink and continue
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};
