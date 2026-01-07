"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { penceToPounds } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import RecordSaleModal from "@/components/sales/RecordSaleModal";
import SellBundleModal from "@/components/bundles/SellBundleModal";
import CreateBundleModal from "@/components/bundles/CreateBundleModal";
import { logger } from "@/lib/logger";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  status: string;
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
  const [showMultiCardModal, setShowMultiCardModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);

  const loadBundles = async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch("/api/admin/bundles?status=active");
      const json = await res.json();
      if (json.ok) {
        setBundles(json.bundles || []);
      }
    } catch (e) {
      logger.error("Failed to load bundles for RecordSalePage", e);
    } finally {
      setLoadingBundles(false);
    }
  };

  const handleBundleSold = () => {
    setSelectedBundle(null);
    loadBundles();
  };

  useEffect(() => {
    loadBundles();
  }, []);

  const handleBundleCreated = () => {
    setShowCreateBundleModal(false);
    loadBundles();
  };

  const handleSellBundle = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setShowBundleModal(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Sale"
        description="Choose how you want to record your sale. Each method is designed for different scenarios."
      />

      {/* Sale Method Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Single Card Sale */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Single Card</h3>
              <p className="text-xs text-gray-600">One card at a time</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Perfect for individual card sales. Click any listed card in your inventory to mark it as sold.
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
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Multi-Card Sale</h3>
              <p className="text-xs text-gray-600">Combine cards at sale time</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Combine multiple individual cards into one sale. Great for custom orders or combining different cards.
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
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bundle Sale</h3>
              <p className="text-xs text-gray-600">Pre-made bundles</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Sell pre-made bundles with fixed prices. Create bundles in advance, then sell them when ready.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreateBundleModal(true)}
              className="flex-1"
              size="sm"
            >
              Create Bundle
            </Button>
            <Button
              variant="primary"
              onClick={loadBundles}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              Sell Bundle
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
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">Feature</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">Single Card</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">Multi-Card</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide">Bundle</th>
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
                <td className="py-2.5 px-4 text-sm text-center text-gray-700">Fixed bundle price</td>
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

      {/* Active Bundles Section */}
      {bundles.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Active Bundles</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadBundles}
            >
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bundles.map((bundle) => {
              const totalCards = bundle.bundle_items.reduce(
                (sum, item) => sum + item.quantity,
                0
              );
              return (
                <div
                  key={bundle.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-900">{bundle.name}</h3>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                      Active
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
                      <div className="text-xs text-gray-500">{totalCards} cards</div>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSellBundle(bundle)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Sell This Bundle
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
}

