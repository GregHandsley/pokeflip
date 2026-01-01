"use client";

import Modal from "./Modal";
import Button from "./Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export default function ErrorModal({ isOpen, onClose, title = "Error", message }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            OK
          </Button>
        </div>
      }
    >
      <p className="text-gray-700">{message}</p>
    </Modal>
  );
}

