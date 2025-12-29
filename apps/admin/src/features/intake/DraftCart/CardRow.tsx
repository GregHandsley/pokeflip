"use client";

import { CONDITIONS, Condition } from "../types";
import { poundsToPence, penceToPounds } from "@pokeflip/shared";
import type { DraftLine } from "./types";

type Props = {
  line: DraftLine;
  cardDisplay: string;
  cardIndex: number;
  totalQty: number;
  acquisitionId: string;
  onUpdate: (id: string, patch: Partial<DraftLine>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  supabase: any;
  setMsg: (msg: string | null) => void;
};

export function CardRow({ line, cardDisplay, cardIndex, totalQty, acquisitionId, onUpdate, onRemove, supabase, setMsg }: Props) {
  const isFirstCard = cardIndex === 1;

  const handleChange = async (field: string, value: any) => {
    // If the line has quantity > 1, we need to split the edited card into its own line
    if (line.quantity > 1) {
      const newLine: any = {
        acquisition_id: acquisitionId,
        set_id: line.set_id,
        card_id: line.card_id,
        condition: line.condition,
        quantity: 1,
        for_sale: line.for_sale,
        list_price_pence: line.list_price_pence,
        note: line.note,
        status: "draft",
      };
      
      // Apply the change to the new line
      if (field === 'condition') {
        newLine.condition = value;
      } else if (field === 'for_sale') {
        newLine.for_sale = value;
        newLine.list_price_pence = value ? (line.list_price_pence ?? poundsToPence("0.99")) : null;
      } else if (field === 'list_price_pence') {
        newLine.list_price_pence = value;
        newLine.for_sale = line.for_sale;
      } else if (field === 'note') {
        newLine.note = value;
      }

      // Insert the new line first
      const { error: insertError } = await supabase.from("intake_lines").insert(newLine as any);
      if (insertError) {
        setMsg(insertError.message);
        return;
      }

      // Then decrease the original line's quantity
      await onUpdate(line.id, { quantity: line.quantity - 1 });
    } else {
      // Single card line - update directly
      if (field === 'for_sale') {
        await onUpdate(line.id, {
          for_sale: value,
          list_price_pence: value ? (line.list_price_pence ?? poundsToPence("0.99")) : null
        });
      } else {
        await onUpdate(line.id, { [field]: value });
      }
    }
  };

  const handleRemove = async () => {
    if (isFirstCard && line.quantity > 1) {
      await onUpdate(line.id, { quantity: line.quantity - 1 });
    } else if (isFirstCard && line.quantity === 1) {
      await onRemove(line.id);
    } else {
      if (line.quantity > 1) {
        await onUpdate(line.id, { quantity: line.quantity - 1 });
      } else {
        await onRemove(line.id);
      }
    }
  };

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-black/5 transition-colors">
      {/* Camera icon - invisible for grouped cards to maintain alignment */}
      <div className="col-span-1">
        <div className="w-7 h-7 invisible pointer-events-none"></div>
      </div>

      {/* Card name */}
      <div className="col-span-3">
        <div className="font-medium text-sm truncate">
          {cardDisplay}
          {totalQty > 1 && <span className="text-xs text-black/50 ml-1">({cardIndex}/{totalQty})</span>}
        </div>
      </div>

      {/* Condition */}
      <div className="col-span-2">
        <select
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs bg-white font-medium text-black"
          value={line.condition}
          onChange={(e) => handleChange('condition', e.target.value as Condition)}
        >
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Quantity - always show as 1 for individual cards */}
      <div className="col-span-1">
        <div className="text-xs text-black/60 text-center">1</div>
      </div>

      {/* For sale */}
      <div className="col-span-1 flex justify-center">
        <input
          type="checkbox"
          checked={line.for_sale}
          onChange={(e) => handleChange('for_sale', e.target.checked)}
          className="w-4 h-4"
        />
      </div>

      {/* Price */}
      <div className="col-span-2">
        <input
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50"
          disabled={!line.for_sale}
          value={line.for_sale ? (line.list_price_pence != null ? penceToPounds(line.list_price_pence) : "") : ""}
          onChange={(e) => handleChange('list_price_pence', poundsToPence(e.target.value))}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>

      {/* Remove */}
      <div className="col-span-1">
        <button
          type="button"
          onClick={handleRemove}
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          title="Remove this card"
        >
          ×
        </button>
      </div>
    </div>
  );
}

