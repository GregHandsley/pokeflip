"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import { logger } from "@/lib/logger";

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

type SalesOrder = {
  id: string;
  sold_at: string;
  platform_order_ref: string | null;
  fees_pence: number | null;
  shipping_pence: number | null;
  discount_pence: number | null;
  order_group: string | null;
  buyers: {
    id: string;
    handle: string;
    platform: string;
  } | null;
  sales_items: Array<{
    id: string;
    qty: number;
    sold_price_pence: number;
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
  sales_consumables: Array<{
    id: string;
    qty: number;
    consumables: {
      id: string;
      name: string;
      unit: string;
      avg_cost_pence_per_unit?: number;
    } | null;
  }>;
};

type Props = {
  bundle: Bundle;
  isOpen: boolean;
  onClose: () => void;
};

export default function SoldBundleDetailsModal({ bundle, isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSalesDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bundles/${bundle.id}/sales`);
      const json = await res.json();
      if (json.ok) {
        setSalesOrders(json.sales || []);
      } else {
        setError(json.error || "Failed to load sale details");
      }
    } catch (e) {
      logger.error("Failed to load bundle sales", e);
      setError("Failed to load sale details");
    } finally {
      setLoading(false);
    }
  }, [bundle.id]);

  useEffect(() => {
    if (isOpen) {
      loadSalesDetails();
    }
  }, [isOpen, loadSalesDetails]);

  const calculateSaleTotals = (order: SalesOrder) => {
    const revenue = order.sales_items.reduce(
      (sum, item) => sum + item.sold_price_pence * item.qty,
      0
    );
    const fees = order.fees_pence || 0;
    const shipping = order.shipping_pence || 0;
    const discount = order.discount_pence || 0;
    const consumablesCost = order.sales_consumables.reduce((sum, sc) => {
      const unitCost = sc.consumables?.avg_cost_pence_per_unit ?? 0;
      return sum + unitCost * sc.qty;
    }, 0);

    const revenueAfterDiscount = revenue - discount;
    const totalCosts = fees + shipping + consumablesCost;
    const netProfit = revenueAfterDiscount - totalCosts;
    const margin = revenueAfterDiscount > 0 ? (netProfit / revenueAfterDiscount) * 100 : 0;

    return {
      revenue,
      revenueAfterDiscount,
      fees,
      shipping,
      discount,
      consumablesCost,
      totalCosts,
      netProfit,
      margin,
    };
  };

  const totalCards = bundle.bundle_items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bundle Details: ${bundle.name}`}
      maxWidth="6xl"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Bundle Information */}
        <div>
          <h3 className="font-semibold mb-3">Bundle Information</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Bundle Price:</span>
              <span className="font-semibold">£{penceToPounds(bundle.price_pence)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Cards:</span>
              <span className="font-semibold">{totalCards}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold capitalize">{bundle.status}</span>
            </div>
            {bundle.description && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-600">Description:</span>
                <p className="text-sm text-gray-700 mt-1">{bundle.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cards in Bundle */}
        <div>
          <h3 className="font-semibold mb-3">Cards in Bundle</h3>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
            {bundle.bundle_items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                {item.inventory_lots?.cards?.api_image_url && (
                  <div className="relative h-12 w-auto rounded border border-gray-200 overflow-hidden">
                    <Image
                      src={`${item.inventory_lots.cards.api_image_url}/low.webp`}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    #{item.inventory_lots?.cards?.number} {item.inventory_lots?.cards?.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.inventory_lots?.cards?.sets?.name} • {item.inventory_lots?.condition} •
                    Qty: {item.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales History */}
        <div>
          <h3 className="font-semibold mb-3">Sales History</h3>
          {loading ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              Loading sales information...
            </div>
          ) : salesOrders.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">
              {bundle.status === "sold"
                ? "This bundle is marked as sold but no sales orders were found. This may indicate the bundle was manually marked as sold."
                : "No sales found for this bundle."}
            </div>
          ) : (
            <div className="space-y-4">
              {salesOrders.map((order) => {
                const totals = calculateSaleTotals(order);
                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">
                          Sold: {new Date(order.sold_at).toLocaleDateString()}{" "}
                          {new Date(order.sold_at).toLocaleTimeString()}
                        </div>
                        {order.buyers && (
                          <div className="text-xs text-gray-600 mt-1">
                            Buyer: {order.buyers.handle} ({order.buyers.platform})
                          </div>
                        )}
                        {order.platform_order_ref && (
                          <div className="text-xs text-gray-600">
                            Order Ref: {order.platform_order_ref}
                          </div>
                        )}
                        {order.order_group && (
                          <div className="text-xs text-gray-600">
                            Order Group: {order.order_group}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cards Sold in this Order */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">Cards Sold:</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {order.sales_items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs bg-white rounded p-2"
                          >
                            {item.inventory_lots?.cards?.api_image_url && (
                              <div className="relative h-8 w-auto rounded border border-gray-200 overflow-hidden">
                                <Image
                                  src={`${item.inventory_lots.cards.api_image_url}/low.webp`}
                                  alt=""
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                #{item.inventory_lots?.cards?.number}{" "}
                                {item.inventory_lots?.cards?.name}
                              </div>
                              <div className="text-gray-600">
                                Qty: {item.qty} × £{penceToPounds(item.sold_price_pence)} = £
                                {penceToPounds(item.sold_price_pence * item.qty)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Consumables Used */}
                    {order.sales_consumables && order.sales_consumables.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">Consumables:</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {order.sales_consumables.map((sc, idx) => {
                            const unitCost = sc.consumables?.avg_cost_pence_per_unit ?? 0;
                            const totalCost = unitCost * sc.qty;
                            return (
                              <div key={idx} className="text-xs bg-white rounded p-2">
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    {sc.consumables?.name || "Unknown"} × {sc.qty}{" "}
                                    {sc.consumables?.unit || "each"}
                                  </span>
                                  {unitCost > 0 && (
                                    <span className="text-gray-600">
                                      £{penceToPounds(totalCost)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="border-t border-gray-300 pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Revenue:</span>
                          <span className="font-semibold">£{penceToPounds(totals.revenue)}</span>
                        </div>
                        {totals.discount > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span>-£{penceToPounds(totals.discount)}</span>
                          </div>
                        )}
                        {totals.fees > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fees:</span>
                            <span className="text-red-600">-£{penceToPounds(totals.fees)}</span>
                          </div>
                        )}
                        {totals.shipping > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Shipping:</span>
                            <span className="text-red-600">-£{penceToPounds(totals.shipping)}</span>
                          </div>
                        )}
                        {totals.consumablesCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Consumables:</span>
                            <span className="text-red-600">
                              -£{penceToPounds(totals.consumablesCost)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-300 col-span-2">
                          <span>Net Profit:</span>
                          <span
                            className={totals.netProfit >= 0 ? "text-green-600" : "text-red-600"}
                          >
                            £{penceToPounds(totals.netProfit)} ({totals.margin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
