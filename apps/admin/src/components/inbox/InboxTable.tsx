"use client";

import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";

type InboxLot = {
  lot_id: string;
  card_id: string;
  card_number: string;
  card_name: string;
  set_name: string;
  rarity: string | null;
  rarity_rank: number;
  condition: string;
  status: string;
  for_sale: boolean;
  list_price_pence: number | null;
  quantity: number;
  available_qty: number;
  photo_count: number;
  updated_at: string;
  created_at: string;
  use_api_image?: boolean;
  api_image_url?: string | null;
  has_front_photo?: boolean;
  has_back_photo?: boolean;
  has_required_photos?: boolean;
  market_price_pence?: number | null;
  above_floor?: boolean;
};

interface Props {
  lots: InboxLot[];
  loading: boolean;
  selectedLotIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onLotClick?: (lot: InboxLot) => void;
}

// Get valuable threshold (default to £10)
const VALUABLE_THRESHOLD_GBP = 10.0;
const RARE_RARITY_RANK = 4; // Ultra Rare and above

export default function InboxTable({
  lots,
  loading,
  selectedLotIds,
  onSelectionChange,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onLotClick,
}: Props) {
  const [valuableThreshold, setValuableThreshold] = useState(VALUABLE_THRESHOLD_GBP);

  useEffect(() => {
    // Load threshold from config (could be from API)
    // For now, use default
  }, []);

  const toggleSelection = (lotId: string) => {
    const newSelection = new Set(selectedLotIds);
    if (newSelection.has(lotId)) {
      newSelection.delete(lotId);
    } else {
      newSelection.add(lotId);
    }
    onSelectionChange(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLotIds.size === lots.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(lots.map((l) => l.lot_id)));
    }
  };

  const isValuable = (lot: InboxLot) => {
    if (!lot.list_price_pence) return false;
    return penceToPounds(lot.list_price_pence) >= valuableThreshold;
  };

  const isRare = (lot: InboxLot) => {
    return lot.rarity_rank >= RARE_RARITY_RANK;
  };


  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-600">Loading inbox lots...</div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-600">No lots in inbox</div>
        <div className="text-sm text-gray-500 mt-2">
          Lots ready to list will appear here.
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={lots.length > 0 && selectedLotIds.size === lots.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Card
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Condition
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Qty
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Market
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Rarity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Photos
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Highlights
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lots.map((lot) => {
              const selected = selectedLotIds.has(lot.lot_id);
              const valuable = isValuable(lot);
              const rare = isRare(lot);

              return (
                <tr
                  key={lot.lot_id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selected ? "bg-blue-50" : ""
                  } ${onLotClick ? "cursor-pointer" : ""}`}
                  onClick={() => onLotClick?.(lot)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelection(lot.lot_id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      aria-label={`Select lot ${lot.card_name} #${lot.card_number}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          <span className="text-gray-500 font-normal">#{lot.card_number}</span>{" "}
                          {lot.card_name}
                        </div>
                        <div className="text-xs text-gray-500">{lot.set_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] ||
                      lot.condition}
                  </td>
                  <td className="px-4 py-3 text-sm">{lot.available_qty}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {lot.list_price_pence != null
                      ? `£${penceToPounds(lot.list_price_pence)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-700">
                    {lot.market_price_pence != null
                      ? `£${penceToPounds(lot.market_price_pence)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lot.rarity || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lot.use_api_image ? (
                      <span className="flex items-center gap-1 text-blue-600" title="Using API image">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        API
                      </span>
                    ) : lot.has_required_photos ? (
                      <span className="flex items-center gap-1 text-green-600" title="Has required photos">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {lot.photo_count}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600" title="Missing required photos (front and back)">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lot.status === "draft" && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1"
                          title="Draft - Saved as draft"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Draft
                        </span>
                      )}
                      {lot.status === "listed" && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1"
                          title="Listed - Uploaded to eBay"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Listed
                        </span>
                      )}
                      {lot.status === "ready" && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                          title="Ready to list"
                        >
                          Ready
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {valuable && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Valuable
                        </span>
                      )}
                      {rare && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Rare
                        </span>
                      )}
                      {lot.above_floor && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Above floor
                        </span>
                      )}
                      {valuable && rare && (
                        <span className="text-lg" title="Valuable & Rare">
                          🔥
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{" "}
            {totalCount} lots
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

