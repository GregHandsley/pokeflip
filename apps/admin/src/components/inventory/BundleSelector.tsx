"use client";

import { useState, useEffect } from "react";
import SellBundleModal from "@/components/bundles/SellBundleModal";
import CreateBundleModal from "@/components/bundles/CreateBundleModal";
import { logger } from "@/lib/logger";

interface Bundle {
  id: string;
  name: string;
  status: string;
}

type BundleWithItems = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  quantity: number;
  bundle_items: Array<{
    id: string;
    quantity: number;
    inventory_lots: {
      id: string;
      condition: string;
      variation: string | null;
      cards: {
        id: string;
        number: string;
        name: string;
        api_image_url: string | null;
        sets: {
          id: string;
          name: string;
        } | null;
      } | null;
    };
  }>;
};

interface BundleSelectorProps {
  lotId: string;
  onBundleAction?: () => void; // Callback when bundle action is taken (to close parent modal)
}

export default function BundleSelector({ lotId, onBundleAction }: BundleSelectorProps) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bundleToSell, setBundleToSell] = useState<BundleWithItems | null>(null);

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
      logger.error("Failed to load bundles", e);
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

      // Fetch the full bundle data to show in SellBundleModal
      const bundleRes = await fetch(`/api/admin/bundles/${selectedBundleId}`);
      const bundleJson = await bundleRes.json();
      if (bundleJson.ok && bundleJson.bundle) {
        setBundleToSell(bundleJson.bundle);
        setSelectedBundleId("");
        if (onBundleAction) {
          onBundleAction(); // Close parent modal (Mark as Sold)
        }
      } else {
        throw new Error("Failed to load bundle data");
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add to bundle");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add to Bundle</label>
        <p className="text-xs text-gray-500 mb-3">
          Add this card to an existing bundle or create a new bundle.
        </p>
      </div>
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
          {adding ? "Adding..." : "Add"}
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
        <CreateBundleModalWithLot
          lotId={lotId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onBundleCreated={() => {
            setShowCreateModal(false);
            loadBundles();
            if (onBundleAction) {
              onBundleAction(); // Close parent modal (Mark as Sold)
            }
          }}
        />
      )}

      {bundleToSell && (
        <SellBundleModal
          bundle={bundleToSell}
          isOpen={!!bundleToSell}
          onClose={() => setBundleToSell(null)}
          onBundleSold={() => {
            setBundleToSell(null);
            loadBundles();
          }}
        />
      )}
    </div>
  );
}

// Wrapper component that uses the full CreateBundleModal with pre-selected lot
function CreateBundleModalWithLot({
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
  return (
    <CreateBundleModal
      isOpen={isOpen}
      onClose={onClose}
      onBundleCreated={onBundleCreated}
      initialLotId={lotId}
    />
  );
}
