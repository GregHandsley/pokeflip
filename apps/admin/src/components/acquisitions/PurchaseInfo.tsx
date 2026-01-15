import { penceToPounds } from "@pokeflip/shared";
import type { Purchase } from "./types";

type PurchaseInfoProps = {
  purchase: Purchase;
  lotCount: number;
};

export function PurchaseInfo({ purchase, lotCount }: PurchaseInfoProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Type:</span>{" "}
          <span className="font-medium capitalize">{purchase.source_type}</span>
        </div>
        <div>
          <span className="text-gray-600">Total:</span>{" "}
          <span className="font-medium">£{penceToPounds(purchase.purchase_total_pence)}</span>
        </div>
        <div>
          <span className="text-gray-600">Status:</span>{" "}
          <span
            className={`px-2 py-1 rounded text-xs font-medium capitalize ${
              purchase.status === "closed"
                ? "bg-gray-100 text-gray-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {purchase.status}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Cards:</span>{" "}
          <span className="font-medium">{lotCount}</span>
        </div>
      </div>
      {purchase.notes && <div className="mt-3 text-sm text-gray-600 italic">{purchase.notes}</div>}
    </div>
  );
}
