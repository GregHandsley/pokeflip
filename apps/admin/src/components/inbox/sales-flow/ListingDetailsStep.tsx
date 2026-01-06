"use client";

import { useEffect, useState } from "react";
import { InboxLot, SalesData } from "./types";
import { CONDITION_LABELS } from "@/features/intake/CardPicker/types";
import { CARD_VARIATIONS, variationLabel } from "@/components/inventory/variations";

interface Props {
  lot: InboxLot;
  salesData: SalesData | null;
  loadingSalesData: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateVariation: (variation: string) => void;
}

export default function ListingDetailsStep({
  lot,
  salesData,
  loadingSalesData,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateVariation,
}: Props) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [allowedVariations, setAllowedVariations] = useState<string[]>(CARD_VARIATIONS as string[]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [editingVariation, setEditingVariation] = useState(false);

  // Fetch allowed variations from TCGdex for this card
  useEffect(() => {
    let active = true;
    const loadVariants = async () => {
      setLoadingVariants(true);
      try {
        const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(lot.card_id)}`);
        const json = await res.json();
        const variants = json?.variants;
        if (!variants || typeof variants !== "object") {
          throw new Error("No variants field");
        }
        const map: Array<{ key: string; value: string }> = [
          { key: "normal", value: "standard" },
          { key: "holo", value: "holo" },
          { key: "reverse", value: "reverse_holo" },
          { key: "firstEdition", value: "first_edition" },
          { key: "wPromo", value: "promo" },
        ];
        const next = map.filter((m) => variants[m.key] === true).map((m) => m.value);
        const nextAllowed = next.length > 0 ? next : ["standard"];
        if (active) {
          setAllowedVariations(nextAllowed);
          // If current variation not in allowed, snap to first allowed
          if (!nextAllowed.includes(lot.variation || "standard")) {
            onUpdateVariation(nextAllowed[0]);
          }
        }
      } catch (e) {
        console.warn("Failed to load variants; using defaults", e);
        if (active) {
          setAllowedVariations(CARD_VARIATIONS as string[]);
        }
      } finally {
        if (active) setLoadingVariants(false);
      }
    };
    void loadVariants();
    return () => {
      active = false;
    };
  }, [lot.card_id, lot.variation, onUpdateVariation]);

  if (loadingSalesData) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading listing details...</div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="text-center py-8 text-gray-600">
        Failed to load listing details
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card Info Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Card:</span>{" "}
            <span className="font-medium">#{lot.card_number} {lot.card_name}</span>
          </div>
          <div>
            <span className="text-gray-600">Set:</span>{" "}
            <span className="font-medium">{lot.set_name}</span>
          </div>
          <div>
            <span className="text-gray-600">Condition:</span>{" "}
            <span className="font-medium">
              {CONDITION_LABELS[lot.condition as keyof typeof CONDITION_LABELS] ||
                lot.condition}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Variation:</span>{" "}
            <span className="font-medium">{variationLabel(lot.variation)}</span>
          </div>
          <div>
            <span className="text-gray-600">Quantity:</span>{" "}
            <span className="font-medium">{lot.available_qty}</span>
          </div>
          {lot.rarity && (
            <div>
              <span className="text-gray-600">Rarity:</span>{" "}
              <span className="font-medium">{lot.rarity}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Variation
        </label>
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-2 rounded border text-sm bg-gray-50 text-gray-800">
            {variationLabel(lot.variation)}
          </span>
          <button
            type="button"
            onClick={() => setEditingVariation((p) => !p)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {editingVariation ? "Cancel" : "Edit variant"}
          </button>
          {loadingVariants && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        {editingVariation && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {allowedVariations.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onUpdateVariation(v)}
                className={`px-3 py-2 rounded border text-sm transition ${
                  lot.variation === v
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-gray-400 text-gray-700"
                }`}
              >
                {variationLabel(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Listing Title
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={salesData.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="Enter listing title..."
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(salesData.title);
                  setCopyStatus("copied");
                  setTimeout(() => setCopyStatus("idle"), 1500);
                } catch (e) {
                  setCopyStatus("error");
                  setTimeout(() => setCopyStatus("idle"), 1500);
                }
              }}
              className="absolute inset-y-0 right-2 my-auto px-2 h-8 rounded border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-100 transition"
              aria-label="Copy listing title"
            >
              {copyStatus === "copied" ? "✓" : copyStatus === "error" ? "!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Listing Description
        </label>
        <div className="flex items-start gap-2">
          <textarea
            value={salesData.description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            rows={8}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
            placeholder="Enter listing description..."
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(salesData.description);
                setCopyStatus("copied");
                setTimeout(() => setCopyStatus("idle"), 1500);
              } catch (e) {
                setCopyStatus("error");
                setTimeout(() => setCopyStatus("idle"), 1500);
              }
            }}
            className="self-stretch px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition min-w-[70px]"
            aria-label="Copy listing description"
          >
            {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Failed" : "Copy"}
          </button>
        </div>
      </div>

      {/* Bundle Integration - Placeholder for future bundle functionality */}
      <div className="border-t border-gray-200 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add to Bundle
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Add this card to an existing bundle or create a new bundle.
        </p>
        <BundleSelector lotId={lot.lot_id} />
      </div>
    </div>
  );
}

// Bundle Selector Component
function BundleSelector({ lotId }: { lotId: string }) {
  const [bundles, setBundles] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bundles?status=active");
      const json = await res.json();
      if (json.ok) {
        setBundles(json.bundles || []);
      }
    } catch (e) {
      console.error("Failed to load bundles:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBundle = async () => {
    if (!selectedBundleId) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/admin/bundles/${selectedBundleId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: lotId,
          quantity: 1,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to add to bundle");
      }

      alert("Card added to bundle successfully!");
      setSelectedBundleId("");
      loadBundles();
    } catch (e: any) {
      alert(e.message || "Failed to add to bundle");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedBundleId}
          onChange={(e) => setSelectedBundleId(e.target.value)}
          disabled={loading || adding}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select a bundle...</option>
          {bundles.map((bundle) => (
            <option key={bundle.id} value={bundle.id}>
              {bundle.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddToBundle}
          disabled={!selectedBundleId || adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {adding ? "Adding..." : "Add to Bundle"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-gray-200"></div>
        <span className="text-xs text-gray-500">or</span>
        <div className="flex-1 border-t border-gray-200"></div>
      </div>
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
      >
        Create New Bundle
      </button>
      {showCreateModal && (
        <CreateBundleFromLotModal
          lotId={lotId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onBundleCreated={() => {
            setShowCreateModal(false);
            loadBundles();
          }}
        />
      )}
    </div>
  );
}

// Create Bundle Modal for single lot
function CreateBundleFromLotModal({
  lotId,
  isOpen,
  onClose,
  onBundleCreated,
}: {
  lotId: string;
  isOpen: boolean;
  onClose: () => void;
  onBundleCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a bundle name");
      return;
    }

    if (!price.trim() || parseFloat(price) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { poundsToPence } = await import("@pokeflip/shared");
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          pricePence: poundsToPence(price),
          items: [
            {
              lotId: lotId,
              quantity: 1,
            },
          ],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create bundle");
      }

      onBundleCreated();
      setName("");
      setDescription("");
      setPrice("");
    } catch (e: any) {
      setError(e.message || "Failed to create bundle");
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Create New Bundle</h3>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bundle Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="e.g., Starter Bundle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bundle Price (£) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Bundle"}
          </button>
        </div>
      </div>
    </div>
  );
}

