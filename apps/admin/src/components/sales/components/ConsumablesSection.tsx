import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import type { Consumable, ConsumableSelection } from "../types";

interface Props {
  consumables: Consumable[];
  selectedConsumables: ConsumableSelection[];
  loadingConsumables: boolean;
  onAddConsumable: () => void;
  onRemoveConsumable: (index: number) => void;
  onUpdateConsumable: (index: number, field: keyof ConsumableSelection, value: any) => void;
}

export default function ConsumablesSection({
  consumables,
  selectedConsumables,
  loadingConsumables,
  onAddConsumable,
  onRemoveConsumable,
  onUpdateConsumable,
}: Props) {
  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">Packaging Consumables</label>
        <Button variant="secondary" size="sm" onClick={onAddConsumable}>
          Add Consumable
        </Button>
      </div>
      {loadingConsumables ? (
        <div className="text-sm text-gray-500">Loading consumables...</div>
      ) : selectedConsumables.length === 0 ? (
        <div className="text-sm text-gray-400 italic">
          No consumables added (auto-applied based on card count)
        </div>
      ) : (
        <div className="space-y-2">
          {selectedConsumables.map((consumable, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <select
                value={consumable.consumable_id}
                onChange={(e) => onUpdateConsumable(index, "consumable_id", e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
              >
                <option value="">Select consumable...</option>
                {consumables.map((c) => (
                  <option key={c.consumable_id} value={c.consumable_id}>
                    {c.name} ({c.unit}) - £{penceToPounds(c.avg_cost_pence_per_unit)}/unit
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                value={consumable.qty.toString()}
                onChange={(e) => onUpdateConsumable(index, "qty", parseInt(e.target.value, 10) || 1)}
                className="w-20"
                placeholder="Qty"
              />
              <div className="text-xs text-gray-600 w-24 text-right">
                £{penceToPounds(consumable.qty * consumable.unit_cost_pence)}
              </div>
              <button
                onClick={() => onRemoveConsumable(index)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

