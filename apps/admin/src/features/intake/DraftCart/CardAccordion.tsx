"use client";

import { useState } from "react";
import { poundsToPence } from "@pokeflip/shared";
import type { DraftLine } from "./types";
import { CardRow } from "./CardRow";
import { SingleCardRow } from "./SingleCardRow";

type Props = {
  cardId: string;
  cardLines: DraftLine[];
  cardDisplay: string;
  imageUrl: string | null;
  totalQty: number;
  setId: string;
  acquisitionId: string;
  expandedCards: Set<string>;
  cardGroupKey: string;
  onToggleCard: (key: string) => void;
  onUpdate: (id: string, patch: Partial<DraftLine>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onHoverImage: (url: string, name: string, x: number, y: number) => void;
  onLeaveImage: () => void;
  supabase: any;
  setMsg: (msg: string | null) => void;
  shouldAutoExpand?: boolean;
};

export function CardAccordion({
  cardId,
  cardLines,
  cardDisplay,
  imageUrl,
  totalQty,
  setId,
  acquisitionId,
  expandedCards,
  cardGroupKey,
  onToggleCard,
  onUpdate,
  onRemove,
  onHoverImage,
  onLeaveImage,
  supabase,
  setMsg,
  shouldAutoExpand,
}: Props) {
  const isCardExpanded = expandedCards.has(cardGroupKey) || shouldAutoExpand;
  const hasQuantityGreaterThanOne = cardLines.some(l => l.quantity > 1);
  const showCardAccordion = hasQuantityGreaterThanOne || cardLines.length > 1;

  const toggleCard = () => {
    onToggleCard(cardGroupKey);
  };

  // Single card, single condition, quantity 1 - show directly
  if (!showCardAccordion && cardLines.length === 1 && cardLines[0].quantity === 1) {
    return (
      <SingleCardRow
        line={cardLines[0]}
        cardDisplay={cardDisplay}
        imageUrl={imageUrl}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onHoverImage={onHoverImage}
        onLeaveImage={onLeaveImage}
      />
    );
  }

  // Show card accordion
  return (
    <div className="border-b border-black/5 last:border-b-0">
      {/* Card header with camera icon and quantity selector */}
      <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <button
            type="button"
            onClick={toggleCard}
            className="text-black/40 text-xs"
          >
            {isCardExpanded ? '▼' : '▶'}
          </button>
          {imageUrl && (
            <div
              className="relative p-1.5 rounded hover:bg-black/10 transition-colors cursor-pointer"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onHoverImage(imageUrl, cardDisplay, rect.right + 10, rect.top);
              }}
              onMouseLeave={onLeaveImage}
              title="Hover to view card image"
            >
              <svg className="w-4 h-4 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          )}
          <div className="font-medium text-sm">{cardDisplay}</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-black/60 flex items-center gap-2">
            Qty:
            <input
              className="w-16 rounded border border-black/10 px-2 py-1 text-xs"
              type="number"
              min={1}
              value={totalQty}
              onChange={async (e) => {
                const newQty = Number(e.target.value);
                const currentQty = totalQty;
                
                if (newQty > currentQty) {
                  // Add more cards - increment the first line's quantity
                  const firstLine = cardLines[0];
                  const diff = newQty - currentQty;
                  await onUpdate(firstLine.id, { quantity: firstLine.quantity + diff });
                } else if (newQty < currentQty) {
                  // Remove cards - decrease quantities starting from the last line
                  let remaining = currentQty - newQty;
                  for (let i = cardLines.length - 1; i >= 0 && remaining > 0; i--) {
                    const line = cardLines[i];
                    if (line.quantity <= remaining) {
                      await onRemove(line.id);
                      remaining -= line.quantity;
                    } else {
                      await onUpdate(line.id, { quantity: line.quantity - remaining });
                      remaining = 0;
                    }
                  }
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </label>
          <span className="text-xs text-black/60">{totalQty} card{totalQty !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Card content - individual card rows */}
      {isCardExpanded && (
        <div className="bg-black/2 border-t border-black/5">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-black/5 text-xs font-semibold text-black/70">
            <div className="col-span-1"></div>
            <div className="col-span-4">Card</div>
            <div className="col-span-2">Cond</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-1">Sale</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-1"></div>
          </div>

          {/* Individual card rows - one per card */}
          <div className="divide-y divide-black/5">
            {(() => {
              // Flatten all cards from all lines and track global index
              const allCards: Array<{ line: DraftLine; lineIndex: number; globalIndex: number }> = [];
              let globalIndex = 0;
              
              cardLines.forEach((l) => {
                for (let i = 0; i < l.quantity; i++) {
                  globalIndex++;
                  allCards.push({
                    line: l,
                    lineIndex: i,
                    globalIndex
                  });
                }
              });

              return allCards.map(({ line: l, globalIndex: cardIndex }) => (
                <CardRow
                  key={`${l.id}-${cardIndex}`}
                  line={l}
                  cardDisplay={cardDisplay}
                  cardIndex={cardIndex}
                  totalQty={totalQty}
                  acquisitionId={acquisitionId}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  supabase={supabase}
                  setMsg={setMsg}
                />
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

