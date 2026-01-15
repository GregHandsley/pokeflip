"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { penceToPounds } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import RecordSaleModal from "@/components/sales/RecordSaleModal";
import SellBundleModal from "@/components/bundles/SellBundleModal";
import EditBundleModal from "@/components/bundles/EditBundleModal";
import CreateBundleModal from "@/components/bundles/CreateBundleModal";
import SoldBundleDetailsModal from "@/components/bundles/SoldBundleDetailsModal";
import { logger } from "@/lib/logger";
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

export default function RecordSalePage() {
  const router = useRouter();
  const { handleError } = useApiErrorHandler();
  const [showMultiCardModal, setShowMultiCardModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [bundleToEdit, setBundleToEdit] = useState<Bundle | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundleToView, setBundleToView] = useState<Bundle | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [bundleStatusFilter, setBundleStatusFilter] = useState<string>("active");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const loadBundles = useCallback(async () => {
    setLoadingBundles(true);
    try {
      const params = new URLSearchParams();
      if (bundleStatusFilter !== "all") {
        params.set("status", bundleStatusFilter);
      }
      const res = await fetch(`/api/admin/bundles?${params}`);
      const json = await res.json();
      if (json.ok) {
        setBundles(json.bundles || []);
      }
    } catch (e) {
      logger.error("Failed to load bundles for RecordSalePage", e);
    } finally {
      setLoadingBundles(false);
    }
  }, [bundleStatusFilter]);

  const handleBundleSold = () => {
    setSelectedBundle(null);
    loadBundles();
  };

  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  const handleBundleCreated = () => {
    setShowCreateBundleModal(false);
    loadBundles();
  };

  const handleBundleUpdated = () => {
    setBundleToEdit(null);
    loadBundles();
  };

  const handleSellBundle = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setShowBundleModal(true);
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
    <div className="space-y-6">
      <PageHeader
        title="Record Sale"
        description="Choose how you want to record your sale. Each method is designed for different scenarios."
      />

      {/* Sale Method Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Single Card Sale */}
        <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Single Card</h3>
              <p className="text-xs text-gray-600">One card at a time</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Perfect for individual card sales. Click any listed card in your inventory to mark it as
            sold.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/admin/inventory")}
            className="w-full"
            size="sm"
          >
            Go to Inventory
          </Button>
        </div>

        {/* Multi-Card Sale */}
        <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Multi-Card Sale</h3>
              <p className="text-xs text-gray-600">Combine cards at sale time</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Combine multiple individual cards into one sale. Great for custom orders or combining
            different cards.
          </p>
          <Button
            variant="primary"
            onClick={() => setShowMultiCardModal(true)}
            className="w-full bg-green-600 hover:bg-green-700"
            size="sm"
          >
            Record Multi-Card Sale
          </Button>
        </div>

        {/* Bundle Sale */}
        <div className="bg-linear-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bundle Sale</h3>
              <p className="text-xs text-gray-600">Pre-made bundles</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Sell pre-made bundles with fixed prices. Create bundles in advance, then sell them when
            ready.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => setShowCreateBundleModal(true)}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              Create Bundle
            </Button>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Which method should I use?</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Feature
                </th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Single Card
                </th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Multi-Card
                </th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Bundle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2.5 px-4 text-sm text-gray-600">When to use</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">One card sale</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Custom orders</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Pre-made sets</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-sm text-gray-600">Price flexibility</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Per card</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Per card</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">
                  Fixed bundle price
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-sm text-gray-600">Setup required</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">None</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">None</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Create in advance</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-sm text-gray-600">Best for</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Quick sales</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Combining cards</td>
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Reusable sets</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bundles Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold text-gray-900">
              {bundleStatusFilter === "sold"
                ? "Sold Bundles"
                : bundleStatusFilter === "all"
                  ? "All Bundles"
                  : "Active Bundles"}
            </h2>
            <select
              value={bundleStatusFilter}
              onChange={(e) => setBundleStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
            >
              <option value="active">Active Bundles</option>
              <option value="draft">Draft Bundles</option>
              <option value="all">All (including sold)</option>
              <option value="sold">Sold Bundles</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" onClick={loadBundles}>
            Refresh
          </Button>
        </div>
        {loadingBundles ? (
          <div className="text-sm text-gray-500 py-4 text-center">Loading bundles...</div>
        ) : bundles.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">
            {bundleStatusFilter === "sold"
              ? "No sold bundles found."
              : bundleStatusFilter === "all"
                ? "No bundles found."
                : `No ${bundleStatusFilter} bundles found.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bundles.map((bundle) => {
              const totalCards = bundle.bundle_items.reduce((sum, item) => sum + item.quantity, 0);
              const isSold = bundle.status === "sold";
              return (
                <div
                  key={bundle.id}
                  className={`border rounded-lg p-4 transition-shadow ${
                    isSold
                      ? "border-gray-300 bg-gray-50 opacity-75 cursor-pointer hover:bg-gray-100"
                      : "border-gray-200 hover:shadow-sm"
                  }`}
                  onClick={isSold ? () => setBundleToView(bundle) : undefined}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-900">{bundle.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                  {bundle.description && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{bundle.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-base font-bold text-gray-900">
                        £{penceToPounds(bundle.price_pence)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {isSold ? "Sold • " : `${bundle.quantity || 1} available • `}
                        {totalCards} cards per bundle
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSold ? (
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
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSellBundle(bundle);
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          Sell This Bundle
                        </Button>
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
      </div>

      {/* Modals */}
      <RecordSaleModal
        isOpen={showMultiCardModal}
        onClose={() => setShowMultiCardModal(false)}
        onSaleCreated={() => {
          setShowMultiCardModal(false);
        }}
      />

      {selectedBundle && (
        <SellBundleModal
          bundle={selectedBundle}
          isOpen={showBundleModal}
          onClose={() => {
            setShowBundleModal(false);
            setSelectedBundle(null);
          }}
          onBundleSold={handleBundleSold}
        />
      )}

      <CreateBundleModal
        isOpen={showCreateBundleModal}
        onClose={() => setShowCreateBundleModal(false)}
        onBundleCreated={handleBundleCreated}
      />

      {bundleToEdit && (
        <EditBundleModal
          isOpen={!!bundleToEdit}
          onClose={() => setBundleToEdit(null)}
          onBundleUpdated={handleBundleUpdated}
          bundle={bundleToEdit}
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
