"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import CreateBundleModal from "@/components/bundles/CreateBundleModal";
import EditBundleModal from "@/components/bundles/EditBundleModal";
import SellBundleModal from "@/components/bundles/SellBundleModal";
import SoldBundleDetailsModal from "@/components/bundles/SoldBundleDetailsModal";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  quantity: number;
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
  const { handleError } = useApiErrorHandler();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bundleToEdit, setBundleToEdit] = useState<Bundle | null>(null);
  const [bundleToSell, setBundleToSell] = useState<Bundle | null>(null);
  const [bundleToView, setBundleToView] = useState<Bundle | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const loadBundles = useCallback(async () => {
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
      handleError(e, { title: "Failed to load bundles" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, handleError]);

  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  const handleBundleCreated = () => {
    setShowCreateModal(false);
    loadBundles();
  };

  const handleBundleUpdated = () => {
    setBundleToEdit(null);
    loadBundles();
  };

  const handleBundleSold = () => {
    setBundleToSell(null);
    loadBundles();
  };

  const handleDeleteBundle = async (bundleId: string) => {
    setOpenMenuId(null); // Close menu
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
      handleError(e, { title: "Failed to delete bundle" });
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current.get(openMenuId);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  return (
    <div>
      <PageHeader
        title="Bundles"
        description="Create pre-made bundles with a fixed price. Different from multi-card sales - bundles are created in advance, while multi-card sales combine cards at sale time."
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
          >
            <option value="active">Active Bundles</option>
            <option value="draft">Draft Bundles</option>
            <option value="all">All Bundles (including sold)</option>
            <option value="sold">Sold Bundles Only</option>
            <option value="archived">Archived</option>
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
          {statusFilter === "sold"
            ? "No sold bundles found."
            : statusFilter === "all"
              ? "No bundles found. Create your first bundle to get started."
              : `No ${statusFilter} bundles found. ${statusFilter === "active" ? "Create your first bundle to get started." : ""}`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const totalCards = bundle.bundle_items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <div
                key={bundle.id}
                className={`bg-white rounded-lg border p-4 transition-shadow ${
                  bundle.status === "sold"
                    ? "border-gray-300 bg-gray-50 opacity-75 cursor-pointer hover:bg-gray-100"
                    : "border-gray-200 hover:shadow-md"
                }`}
                onClick={bundle.status === "sold" ? () => setBundleToView(bundle) : undefined}
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
                  <div className="text-xs text-gray-600">
                    {bundle.status === "sold"
                      ? "Sold • "
                      : `${bundle.quantity || 1} bundle${bundle.quantity !== 1 ? "s" : ""} available • `}
                    {totalCards} card{totalCards !== 1 ? "s" : ""} per bundle
                  </div>
                </div>

                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                  {bundle.bundle_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {item.inventory_lots?.cards?.api_image_url && (
                        <div className="relative h-8" style={{ width: "auto", minWidth: "32px" }}>
                          <Image
                            src={`${item.inventory_lots.cards.api_image_url}/low.webp`}
                            alt={`${item.inventory_lots.cards.name || "Card"} image`}
                            width={32}
                            height={32}
                            className="h-8 w-auto rounded border border-gray-200 object-contain"
                            unoptimized
                          />
                        </div>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setBundleToSell(bundle);
                      }}
                      className="flex-1"
                    >
                      Sell Bundle
                    </Button>
                  )}
                  {bundle.status === "sold" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBundleToView(bundle);
                      }}
                      className="flex-1"
                    >
                      View Sale Details
                    </Button>
                  )}
                  {bundle.status !== "sold" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBundleToEdit(bundle);
                        }}
                      >
                        Edit
                      </Button>
                      {/* Three-dot menu for additional actions */}
                      <div
                        className="relative"
                        ref={(el) => {
                          if (el) {
                            menuRefs.current.set(bundle.id, el);
                          } else {
                            menuRefs.current.delete(bundle.id);
                          }
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === bundle.id ? null : bundle.id);
                          }}
                          className="px-2 py-1 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
                          aria-label="More options"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            />
                          </svg>
                        </button>
                        {openMenuId === bundle.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBundle(bundle.id);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Delete Bundle
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
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

      {bundleToEdit && (
        <EditBundleModal
          isOpen={!!bundleToEdit}
          onClose={() => setBundleToEdit(null)}
          onBundleUpdated={handleBundleUpdated}
          bundle={bundleToEdit}
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

      {bundleToView && (
        <SoldBundleDetailsModal
          bundle={bundleToView}
          isOpen={!!bundleToView}
          onClose={() => setBundleToView(null)}
        />
      )}
    </div>
  );
}
