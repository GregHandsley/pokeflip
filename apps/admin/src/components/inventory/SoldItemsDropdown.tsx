import { penceToPounds } from "@pokeflip/shared";
import type { SalesItem } from "./CardLotsView.types";

interface Props {
  lotId: string;
  soldQty: number;
  isExpanded: boolean;
  isLoading: boolean;
  salesItems: SalesItem[];
  onToggle: () => void;
}

export default function SoldItemsDropdown({
  soldQty,
  isExpanded,
  isLoading,
  salesItems,
  onToggle,
}: Props) {
  return (
    <div className="mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
      >
        <span className="font-medium">Sold Items ({soldQty})</span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
          {isLoading ? (
            <div className="text-xs text-gray-500">Loading sales...</div>
          ) : salesItems.length === 0 ? (
            <div className="text-xs text-gray-500">No sales found</div>
          ) : (
            salesItems.map((item) => (
              <div key={item.id} className="text-xs bg-gray-50 rounded p-2 border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">
                      {item.qty} × £{penceToPounds(item.sold_price_pence)}
                    </span>
                    <span className="text-gray-500">
                      = £{penceToPounds(item.qty * item.sold_price_pence)}
                    </span>
                  </div>
                </div>
                <div className="mt-1 space-y-0.5 text-gray-600">
                  {item.buyer_handle && (
                    <div>
                      <span className="font-medium">Buyer:</span> {item.buyer_handle}
                    </div>
                  )}
                  {item.order_group && (
                    <div>
                      <span className="font-medium">Order:</span> {item.order_group}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Sold:</span>{" "}
                    {new Date(item.sold_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
