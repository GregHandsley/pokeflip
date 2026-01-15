import { CardPicker } from "@/features/intake/CardPicker";
import type { Condition } from "@/features/intake/types";

type AddCardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (params: {
    setId: string;
    cardId: string;
    locale: string;
    condition: Condition;
    quantity: number;
    variation: string;
  }) => Promise<void>;
};

export function AddCardModal({ isOpen, onClose, onAddCard }: AddCardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold">Add Card to Purchase</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <CardPicker onPickCard={onAddCard} />
        </div>
      </div>
    </div>
  );
}
