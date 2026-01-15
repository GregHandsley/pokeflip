import { Input } from "@/components/ui/Input";
import { penceToPounds } from "@pokeflip/shared";
import type { Buyer } from "../types";

interface Props {
  buyerHandle: string;
  onBuyerHandleChange: (value: string) => void;
  selectedBuyer: Buyer | null;
  buyerSuggestions: Buyer[];
  showBuyerSuggestions: boolean;
  onSelectBuyer: (buyer: Buyer) => void;
  orderGroup: string;
  onOrderGroupChange: (value: string) => void;
  autoGenerateOrderNumber: boolean;
  onAutoGenerateToggle: (checked: boolean) => void;
  fees: string;
  onFeesChange: (value: string) => void;
  shipping: string;
  onShippingChange: (value: string) => void;
}

export default function BuyerOrderForm({
  buyerHandle,
  onBuyerHandleChange,
  selectedBuyer,
  buyerSuggestions,
  showBuyerSuggestions,
  onSelectBuyer,
  orderGroup,
  onOrderGroupChange,
  autoGenerateOrderNumber,
  onAutoGenerateToggle,
  fees,
  onFeesChange,
  shipping,
  onShippingChange,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Handle</label>
          <Input
            type="text"
            value={buyerHandle}
            onChange={(e) => onBuyerHandleChange(e.target.value)}
            onFocus={() => {
              if (buyerHandle.length > 0) {
                onBuyerHandleChange(buyerHandle);
              }
            }}
            placeholder="Enter buyer handle"
            className="w-full"
          />
          {selectedBuyer && (
            <div className="mt-1 text-xs text-gray-600">
              {selectedBuyer.order_count ? (
                <>
                  Repeat buyer: {selectedBuyer.order_count} order
                  {selectedBuyer.order_count !== 1 ? "s" : ""}
                  {selectedBuyer.total_spend_pence != null && (
                    <> • Total spend: £{penceToPounds(selectedBuyer.total_spend_pence)}</>
                  )}
                </>
              ) : (
                "New buyer"
              )}
            </div>
          )}
          {showBuyerSuggestions && buyerSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {buyerSuggestions.map((buyer) => (
                <button
                  key={buyer.id}
                  onClick={() => onSelectBuyer(buyer)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between"
                >
                  <span className="font-medium">{buyer.handle}</span>
                  {buyer.order_count && (
                    <span className="text-xs text-gray-500">
                      {buyer.order_count} order{buyer.order_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Order Number <span className="text-gray-500">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoGenOrder"
                checked={autoGenerateOrderNumber}
                onChange={(e) => onAutoGenerateToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="autoGenOrder" className="text-xs text-gray-600">
                Auto-generate
              </label>
            </div>
          </div>
          <Input
            type="text"
            value={orderGroup}
            onChange={(e) => {
              onOrderGroupChange(e.target.value);
              onAutoGenerateToggle(false);
            }}
            placeholder="Enter or select order number"
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fees (£) <span className="text-gray-500">(optional)</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={fees}
            onChange={(e) => onFeesChange(e.target.value)}
            placeholder="0.00"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shipping (£) <span className="text-gray-500">(optional)</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={shipping}
            onChange={(e) => onShippingChange(e.target.value)}
            placeholder="0.00"
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
