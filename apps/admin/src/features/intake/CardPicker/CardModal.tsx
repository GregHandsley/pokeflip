"use client";

import { useState, useEffect } from "react";
import type { TcgdxCard, Condition } from "./types";
import { CONDITIONS, CONDITION_LABELS } from "./types";

type Props = {
  card: TcgdxCard;
  imageUrl: string;
  selectedSetId: string;
  onAdd: (args: { setId: string; cardId: string; locale: string; condition: Condition; quantity: number }) => Promise<void>;
  onClose: () => void;
  onCardAdded: (cardId: string) => void;
};

export function CardModal({ card, imageUrl, selectedSetId, onAdd, onClose, onCardAdded }: Props) {
  const [quantities, setQuantities] = useState<Record<Condition, number>>({
    NM: 0,
    LP: 0,
    MP: 0,
    HP: 0,
    DMG: 0,
  });

  // Inject animation styles
  useEffect(() => {
    const styleId = 'card-picker-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleAdd = async () => {
    const totalQty = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    if (totalQty === 0) {
      return;
    }

    onCardAdded(card.id);

    const addPromises = CONDITIONS.map(async (condition) => {
      const qty = quantities[condition] || 0;
      if (qty > 0) {
        await onAdd({
          setId: selectedSetId,
          cardId: card.id,
          locale: "en",
          condition,
          quantity: qty,
        });
      }
    });

    await Promise.all(addPromises);
    onClose();
  };

  const totalQty = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full max-h-[90vh] flex flex-col relative"
        style={{
          animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors z-10"
          aria-label="Close"
        >
          ×
        </button>

        <div className="p-3 pb-2 flex-shrink-0">
          <h3 className="text-base font-semibold mb-0.5 pr-8">{card.name}</h3>
          {(card.localId || card.number) && (
            <div className="text-xs text-gray-600 mb-1.5">
              #{card.localId || card.number}
            </div>
          )}
          <div className="aspect-[2.5/3.5] w-full max-w-[100px] mx-auto overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img
              src={imageUrl}
              alt={card.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Set quantities for each condition
            </label>
            <div className="space-y-1">
              {CONDITIONS.map((condition) => {
                const quantity = quantities[condition] || 0;
                return (
                  <div key={condition} className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-700 min-w-[120px]">
                      {CONDITION_LABELS[condition]}
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex items-center border border-gray-300 rounded-md bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            setQuantities(prev => ({
                              ...prev,
                              [condition]: Math.max(0, quantity - 1),
                            }));
                          }}
                          disabled={quantity === 0}
                          className="w-8 h-8 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 font-medium text-base transition-colors"
                          aria-label={`Decrease ${condition} quantity`}
                        >
                          −
                        </button>
                        <div className="w-12 text-center text-sm font-medium text-gray-900 border-x border-gray-300 py-1">
                          {quantity}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setQuantities(prev => ({
                              ...prev,
                              [condition]: quantity + 1,
                            }));
                          }}
                          className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-base transition-colors"
                          aria-label={`Increase ${condition} quantity`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-1.5">
              Total: {totalQty} card(s)
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={totalQty === 0}
              className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

