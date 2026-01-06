"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import CreateBundleModal from "@/components/bundles/CreateBundleModal";
import SellBundleModal from "@/components/bundles/SellBundleModal";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  status: string;
  created_at: string;
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
    } | null;
  }>;
};

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bundleToSell, setBundleToSell] = useState<Bundle | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const loadBundles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/admin/bundles?${params}`);
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

  useEffect(() => {
    loadBundles();
  }, [statusFilter]);

  const handleBundleCreated = () => {
    setShowCreateModal(false);
    loadBundles();
  };

  const handleBundleSold = () => {
    setBundleToSell(null);
    loadBundles();
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!window.confirm("Are you sure you want to delete this bundle?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        loadBundles();
      } else {
        alert(json.error || "Failed to delete bundle");
      }
    } catch (e) {
      console.error("Failed to delete bundle:", e);
      alert("Failed to delete bundle");
    }
  };

  return (
    <div>
      <PageHeader 
        title="Bundles" 
        description="Create pre-made bundles with a fixed price. Different from multi-card sales - bundles are created in advance, while multi-card sales combine cards at sale time."
      />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
          >
            <option value="all">All Bundles</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="sold">Sold</option>
          </select>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Create Bundle
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600 py-8 text-center">Loading bundles...</div>
      ) : bundles.length === 0 ? (
        <div className="text-sm text-gray-600 py-8 text-center">
          No bundles found. Create your first bundle to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const totalCards = bundle.bundle_items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            return (
              <div
                key={bundle.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{bundle.name}</h3>
                    {bundle.description && (
                      <p className="text-sm text-gray-600 mt-1">{bundle.description}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      bundle.status === "active"
                        ? "bg-green-100 text-green-800"
                        : bundle.status === "sold"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {bundle.status}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-bold">£{penceToPounds(bundle.price_pence)}</div>
                  <div className="text-xs text-gray-600">{totalCards} card{totalCards !== 1 ? "s" : ""}</div>
                </div>

                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                  {bundle.bundle_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {item.inventory_lots?.cards?.api_image_url && (
                        <img
                          src={`${item.inventory_lots.cards.api_image_url}/low.webp`}
                          alt=""
                          className="h-8 w-auto rounded border border-gray-200"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          #{item.inventory_lots?.cards?.number} {item.inventory_lots?.cards?.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.inventory_lots?.cards?.sets?.name} • Qty: {item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {bundle.status === "active" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setBundleToSell(bundle)}
                      className="flex-1"
                    >
                      Sell Bundle
                    </Button>
                  )}
                  {bundle.status !== "sold" && (
                    <button
                      onClick={() => handleDeleteBundle(bundle.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateBundleModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onBundleCreated={handleBundleCreated}
        />
      )}

      {bundleToSell && (
        <SellBundleModal
          bundle={bundleToSell}
          isOpen={!!bundleToSell}
          onClose={() => setBundleToSell(null)}
          onBundleSold={handleBundleSold}
        />
      )}
    </div>
  );
}

