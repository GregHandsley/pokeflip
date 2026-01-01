"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import { CardPicker } from "@/features/intake/CardPicker";
import { insertDraftLine } from "@/features/intake/intakeInsert";
import type { Condition } from "@/features/intake/types";
import LotDetailModal from "@/components/inventory/LotDetailModal";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type Lot = {
  id: string;
  card_id: string;
  condition: string;
  quantity: number;
  available_qty: number;
  sold_qty: number;
  for_sale: boolean;
  list_price_pence: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  ebay_status: string;
  photo_count: number;
  card: {
    id: string;
    number: string;
    name: string;
    rarity: string | null;
    image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  listed: "bg-green-100 text-green-700",
  sold: "bg-purple-100 text-purple-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function PurchaseLotsPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params?.id as string;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (purchaseId) {
      loadPurchaseLots();
    }
  }, [purchaseId]);

  const loadPurchaseLots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/acquisitions/${purchaseId}/lots`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load purchase");
      }
      if (json.ok) {
        setPurchase(json.purchase);
        setLots(json.lots || []);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async ({ setId, cardId, locale, condition, quantity, variation }: {
    setId: string;
    cardId: string;
    locale: string;
    condition: Condition;
    quantity: number;
    variation: string;
  }) => {
    setToast(null);
    const { error } = await insertDraftLine({
      acquisitionId: purchaseId,
      setId,
      cardId,
      locale: "en",
      quantity,
      defaults: {
        condition,
        variation,
        forSale: true,
        listPricePounds: "0.99",
      },
    });

    if (error) {
      setToast(error.message || "Failed to add card");
    } else {
      setToast("Card added to draft cart. Commit to add to inventory.");
      setShowAddModal(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Purchase Lots" />
        <div className="text-sm text-gray-600 py-8 text-center">Loading...</div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div>
        <PageHeader title="Purchase Lots" />
        <div className="text-sm text-red-600 py-8 text-center">
          {error || "Purchase not found"}
        </div>
      </div>
    );
  }

  // Group lots by set
  const lotsBySet = lots.reduce((acc, lot) => {
    const setId = lot.card?.set?.id || "unknown";
    if (!acc[setId]) {
      acc[setId] = [];
    }
    acc[setId].push(lot);
    return acc;
  }, {} as Record<string, Lot[]>);

  return (
    <div>
      <PageHeader title={`Purchase: ${purchase.source_name}`} />
      
      {/* Toast */}
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm font-medium ${
          toast.includes("Error") 
            ? "bg-red-50 text-red-700 border border-red-200" 
            : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {toast}
        </div>
      )}

      {/* Purchase Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Type:</span>{" "}
            <span className="font-medium">{purchase.source_type}</span>
          </div>
          <div>
            <span className="text-gray-600">Total:</span>{" "}
            <span className="font-medium">£{penceToPounds(purchase.purchase_total_pence)}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              purchase.status === "closed" ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"
            }`}>
              {purchase.status}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Lots:</span>{" "}
            <span className="font-medium">{lots.length}</span>
          </div>
        </div>
        {purchase.notes && (
          <div className="mt-3 text-sm text-gray-600 italic">{purchase.notes}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Add New Card
        </button>
        <button
          onClick={() => router.push("/admin/inventory")}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          Back to Inventory
        </button>
      </div>

      {/* Lots grouped by set */}
      {Object.keys(lotsBySet).length === 0 ? (
        <div className="text-sm text-gray-600 py-8 text-center">
          No lots in this purchase yet. Add cards and commit to create lots.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(lotsBySet)
            .sort(([setIdA], [setIdB]) => {
              const setA = lotsBySet[setIdA]?.[0]?.card?.set?.name || "";
              const setB = lotsBySet[setIdB]?.[0]?.card?.set?.name || "";
              return setA.localeCompare(setB);
            })
            .map(([setId, setLots]) => {
              const set = setLots[0]?.card?.set;
              return (
                <div key={setId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="font-medium">{set?.name || "Unknown Set"}</div>
                    <div className="text-xs text-gray-600">
                      {setLots.length} lot{setLots.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {setLots.map((lot) => (
                      <div
                        key={lot.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLot(lot)}
                      >
                        <div className="flex items-center gap-4">
                          {lot.card?.image_url && (
                            <img
                              src={`${lot.card.image_url}/low.webp`}
                              alt={`${lot.card.name} card`}
                              className="h-16 w-auto rounded border border-gray-200"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              <span className="text-gray-500 font-normal">#{lot.card?.number}</span>{" "}
                              {lot.card?.name}
                            </div>
                            {lot.card?.rarity && (
                              <div className="text-xs text-gray-500">{lot.card.rarity}</div>
                            )}
                          </div>
                          <div className="text-right text-sm space-y-1">
                            <div>
                              <span className="text-gray-600">Qty:</span>{" "}
                              <span className="font-medium">{lot.available_qty} / {lot.quantity}</span>
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                STATUS_COLORS[lot.status] || STATUS_COLORS.draft
                              }`}>
                                {lot.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">Add Card to Purchase</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CardPicker onPickCard={handleAddCard} />
            </div>
          </div>
        </div>
      )}

      {/* Lot Detail Modal */}
      {selectedLot && (
        <LotDetailModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onLotUpdated={loadPurchaseLots}
          onPhotoCountChanged={(lotId, newCount) => {
            // Update the photo count for the specific lot in the local state
            setLots((prev) =>
              prev.map((lot) =>
                lot.id === lotId ? { ...lot, photo_count: newCount } : lot
              )
            );
          }}
        />
      )}
    </div>
  );
}

