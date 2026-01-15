"use client";

import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftLine } from "./types";
import { CardAccordion } from "./CardAccordion";

type Props = {
  setId: string;
  setLines: DraftLine[];
  isExpanded: boolean;
  onToggle: () => void;
  expandedCards: Set<string>;
  onToggleCard: (key: string) => void;
  onUpdate: (id: string, patch: Partial<DraftLine>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onHoverImage: (url: string, name: string, x: number, y: number) => void;
  onLeaveImage: () => void;
  englishNames: Map<string, string>;
  acquisitionId: string;
  supabase: SupabaseClient;
  setMsg: (msg: string | null) => void;
  newlyAddedCardId?: string | null;
};

// Helper to safely get localId from api_payload
const getLocalId = (payload: unknown): string | undefined => {
  if (payload && typeof payload === "object" && "localId" in payload) {
    const value = (payload as { localId?: unknown }).localId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

// Group lines by card_id within a set
const groupLinesByCard = (setLines: DraftLine[]) => {
  const grouped = new Map<string, DraftLine[]>();
  setLines.forEach((line) => {
    const cardId = line.card_id;
    if (!grouped.has(cardId)) {
      grouped.set(cardId, []);
    }
    grouped.get(cardId)!.push(line);
  });
  return grouped;
};

export function SetAccordion({
  setId,
  setLines,
  isExpanded,
  onToggle,
  expandedCards,
  onToggleCard,
  onUpdate,
  onRemove,
  onHoverImage,
  onLeaveImage,
  englishNames,
  acquisitionId,
  supabase,
  setMsg,
  newlyAddedCardId,
}: Props) {
  const set = setLines[0]?.sets;
  const setTotalQty = useMemo(() => setLines.reduce((sum, l) => sum + l.quantity, 0), [setLines]);

  const cardGroups = useMemo(() => {
    return Array.from(groupLinesByCard(setLines).entries()).sort(
      ([cardIdA, cardLinesA], [cardIdB, cardLinesB]) => {
        // Sort by card number (localId or number field)
        const firstLineA = cardLinesA[0];
        const firstLineB = cardLinesB[0];
        const localIdA = firstLineA.cards?.api_payload
          ? getLocalId(firstLineA.cards.api_payload)
          : undefined;
        const numberA = firstLineA.cards?.number?.split("-")[0]?.trim();
        const localIdB = firstLineB.cards?.api_payload
          ? getLocalId(firstLineB.cards.api_payload)
          : undefined;
        const numberB = firstLineB.cards?.number?.split("-")[0]?.trim();

        // Try to get numeric value for sorting
        const numA = parseInt(localIdA || numberA || "0", 10);
        const numB = parseInt(localIdB || numberB || "0", 10);

        // If both are valid numbers, sort numerically
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }

        // Otherwise sort by string
        const strA = localIdA || numberA || cardIdA;
        const strB = localIdB || numberB || cardIdB;
        return strA.localeCompare(strB);
      }
    );
  }, [setLines]);

  return (
    <div className="border border-black/10 rounded-lg overflow-hidden bg-white">
      {/* Set header - accordion trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-black/40">{isExpanded ? "▼" : "▶"}</div>
          <h3 className="font-semibold text-base">{set?.name || "Unknown set"}</h3>
        </div>
        <span className="text-xs text-black/60">
          {setTotalQty} card{setTotalQty !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Set content - accordion panel */}
      {isExpanded && (
        <div className="border-t border-black/10">
          {cardGroups.map(([cardId, cardLines]) => {
            const firstLine = cardLines[0];
            const localId = firstLine.cards?.api_payload
              ? getLocalId(firstLine.cards.api_payload)
              : undefined;
            const numberField = firstLine.cards?.number?.split("-")[0]?.trim();
            const baseNumber = localId || numberField;
            const cardName = englishNames.get(cardId) || firstLine.cards?.name || "Unknown card";
            const cardDisplay = baseNumber ? `${baseNumber} ${cardName}` : cardName;
            const totalQty = cardLines.reduce((sum, l) => sum + l.quantity, 0);
            const cardGroupKey = `${setId}-${cardId}`;
            const imageUrl = firstLine.cards?.api_image_url
              ? `${firstLine.cards.api_image_url}/high.webp`
              : null;
            // Auto-expand if this is the newly added card and it has multiple entries
            const shouldAutoExpand =
              newlyAddedCardId === cardId &&
              (cardLines.length > 1 || cardLines.some((l) => l.quantity > 1));

            return (
              <CardAccordion
                key={cardId}
                cardId={cardId}
                cardLines={cardLines}
                cardDisplay={cardDisplay}
                imageUrl={imageUrl}
                totalQty={totalQty}
                setId={setId}
                acquisitionId={acquisitionId}
                expandedCards={expandedCards}
                cardGroupKey={cardGroupKey}
                onToggleCard={onToggleCard}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onHoverImage={onHoverImage}
                onLeaveImage={onLeaveImage}
                supabase={supabase}
                setMsg={setMsg}
                shouldAutoExpand={shouldAutoExpand}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
