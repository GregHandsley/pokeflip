import { Input } from "@/components/ui/Input";
import { penceToPounds } from "@pokeflip/shared";
import type { SaleItem, PurchaseAllocation } from "../types";
import { autoAllocatePurchases } from "../utils/saleCalculations";

interface Props {
  saleItems: SaleItem[];
  onUpdateItem: (
    index: number,
    field:
      | "qty"
      | "pricePence"
      | "isFree"
      | "selectedPurchaseId"
      | "manualAllocation"
      | "purchaseAllocation",
    value: string | number | boolean | PurchaseAllocation | null
  ) => void;
  onRemoveItem: (index: number) => void;
  onError: (message: string) => void;
}

export default function SaleItemsList({ saleItems, onUpdateItem, onRemoveItem, onError }: Props) {
  const getPurchaseDisplay = (item: SaleItem) => {
    const purchases = item.lot?.purchases || [];
    if (purchases.length === 0) {
      return { type: "none" as const };
    }
    if (purchases.length === 1) {
      return { type: "single" as const, purchase: purchases[0] };
    }

    const totalAvailable = item.lot?.available_qty || 0;
    if (item.qty >= totalAvailable) {
      return { type: "all" as const, purchases };
    }

    const isManual = item.manualAllocation === true;
    const allocations = isManual ? item.purchaseAllocations || [] : autoAllocatePurchases(item);

    return { type: "allocation" as const, purchases, isManual, allocations };
  };

  if (saleItems.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-3">Cards in Sale</h3>
      <div className="space-y-3">
        {saleItems.map((item, index) => {
          const purchaseDisplay = getPurchaseDisplay(item);
          return (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {item.lot?.card
                    ? `#${item.lot.card.number} ${item.lot.card.name}`
                    : "Unknown card"}
                </div>
                <div className="text-xs text-gray-600">
                  {item.lot?.card?.set?.name} • {item.lot?.condition}
                </div>
                {purchaseDisplay.type === "single" && (
                  <div className="text-xs text-gray-500 mt-1">
                    From: {purchaseDisplay.purchase.source_name}
                  </div>
                )}
                {purchaseDisplay.type === "all" && (
                  <div className="text-xs text-gray-500 mt-1">
                    From: {purchaseDisplay.purchases.map((p) => p.source_name).join(", ")}
                  </div>
                )}
                {purchaseDisplay.type === "allocation" && (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={purchaseDisplay.isManual}
                        onChange={(e) => onUpdateItem(index, "manualAllocation", e.target.checked)}
                        className="w-3 h-3"
                      />
                      <span>Manually allocate across purchases</span>
                    </label>
                    {purchaseDisplay.isManual ? (
                      <div className="space-y-1.5 pl-5">
                        {purchaseDisplay.purchases.map((purchase) => {
                          const allocation = purchaseDisplay.allocations.find(
                            (a) => a.purchaseId === purchase.id
                          );
                          const qty = allocation?.qty || 0;
                          const maxQty = Math.min(purchase.quantity, item.qty);
                          return (
                            <div key={purchase.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-32 truncate">
                                {purchase.source_name}:
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={maxQty}
                                value={qty}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value, 10) || 0;
                                  onUpdateItem(index, "purchaseAllocation", {
                                    purchaseId: purchase.id,
                                    qty: Math.min(newQty, maxQty),
                                  });
                                }}
                                className="w-16 text-xs px-2 py-1 border border-gray-300 rounded"
                              />
                              <span className="text-xs text-gray-500">
                                / {purchase.quantity} available
                              </span>
                            </div>
                          );
                        })}
                        <div className="text-xs text-gray-500 mt-1">
                          Total: {purchaseDisplay.allocations.reduce((sum, a) => sum + a.qty, 0)} /{" "}
                          {item.qty}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 pl-5">
                        Auto-allocated:{" "}
                        {purchaseDisplay.allocations
                          .map((a) => {
                            const purchase = purchaseDisplay.purchases.find(
                              (p) => p.id === a.purchaseId
                            );
                            return `${purchase?.source_name} (${a.qty})`;
                          })
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <label className="text-xs text-gray-600">Qty</label>
                  <Input
                    type="number"
                    min="1"
                    max={item.lot?.available_qty || 1}
                    value={item.qty.toString()}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value, 10) || 1;
                      const lot = item.lot;
                      if (lot && qty > lot.available_qty) {
                        onError(`Only ${lot.available_qty} available`);
                        return;
                      }
                      onUpdateItem(index, "qty", e.target.value);
                    }}
                    className="w-20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Price (£)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.pricePence ? penceToPounds(item.pricePence) : ""}
                    onChange={(e) => onUpdateItem(index, "pricePence", e.target.value)}
                    className="w-24"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Subtotal</label>
                  <div className="w-24 h-10 px-3 py-2 text-sm font-medium bg-gray-50 border border-gray-200 rounded-md flex items-center justify-end text-gray-900">
                    £{(((item.pricePence || 0) * item.qty) / 100).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveItem(index)}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
