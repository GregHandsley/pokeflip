"use client";

import { useState, useEffect } from "react";
import { penceToPounds } from "@pokeflip/shared";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import OperationalDashboard from "@/components/analytics/OperationalDashboard";
import RecordSaleModal from "@/components/sales/RecordSaleModal";

type ProfitData = {
  sales_order_id: string;
  sold_at: string;
  revenue_pence: number;
  revenue_after_discount_pence?: number;
  discount_pence?: number;
  fees_pence: number | null;
  shipping_pence: number | null;
  consumables_cost_pence: number;
  total_costs_pence: number;
  net_profit_pence: number;
  margin_percent: number;
  consumables_breakdown?: Array<{
    consumable_id: string;
    consumable_name: string;
    qty: number;
    unit: string;
    unit_cost_pence: number;
    total_cost_pence: number;
  }>;
};

type SalesOrder = {
  id: string;
  sold_at: string;
  buyer: {
    handle: string;
  } | null;
  sales_items: Array<{
    qty: number;
    sold_price_pence: number;
    lot: {
      card: {
        name: string;
        number: string;
      } | null;
    } | null;
  }>;
};

export default function SalesPage() {
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderProfit, setOrderProfit] = useState<ProfitData | null>(null);
  const [showRecordSaleModal, setShowRecordSaleModal] = useState(false);

  useEffect(() => {
    loadSales();
    
    // Check for orderId in URL params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get("orderId");
      if (orderId) {
        handleViewOrder(orderId);
        // Clean up URL
        window.history.replaceState({}, "", "/admin/sales");
      }
    }
  }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      // Get all sales orders
      const ordersRes = await fetch("/api/admin/sales/orders");
      const ordersJson = await ordersRes.json();
      if (ordersJson.ok) {
        setSalesOrders(ordersJson.orders || []);
        
        // Get profit data for all orders
        const profitPromises = (ordersJson.orders || []).map(async (order: SalesOrder) => {
          const profitRes = await fetch(`/api/admin/sales/${order.id}/profit`);
          const profitJson = await profitRes.json();
          return profitJson.ok ? profitJson.profit : null;
        });
        
        const profits = await Promise.all(profitPromises);
        setProfitData(profits.filter(Boolean));
      }
    } catch (e) {
      console.error("Failed to load sales:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (orderId: string) => {
    setSelectedOrder(orderId);
    try {
      const res = await fetch(`/api/admin/sales/${orderId}/profit`);
      const json = await res.json();
      if (json.ok) {
        setOrderProfit(json.profit);
      }
    } catch (e) {
      console.error("Failed to load order profit:", e);
    }
  };

  const [overallProfit, setOverallProfit] = useState<{
    purchase_cost_pence: number;
    revenue_pence: number;
    consumables_cost_pence: number;
    total_costs_pence: number;
    net_profit_pence: number;
    margin_percent: number;
  } | null>(null);

  useEffect(() => {
    loadOverallProfit();
  }, []);

  const loadOverallProfit = async () => {
    try {
      const res = await fetch("/api/admin/sales/overall-profit");
      const json = await res.json();
      if (json.ok && json.profit) {
        setOverallProfit(json.profit);
      }
    } catch (e) {
      console.error("Failed to load overall profit:", e);
    }
  };

  const totalRevenue = profitData.reduce((sum, p) => sum + ((p.revenue_after_discount_pence ?? p.revenue_pence) || 0), 0);
  const totalCosts = profitData.reduce((sum, p) => sum + (p.total_costs_pence || 0), 0);
  const totalProfit = profitData.reduce((sum, p) => sum + (p.net_profit_pence || 0), 0);
  const avgMargin = profitData.length > 0
    ? profitData.reduce((sum, p) => sum + (p.margin_percent || 0), 0) / profitData.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales & Profit Reports</h1>
          <p className="text-sm text-gray-600 mt-1">Track revenue, costs, and profit margins</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowRecordSaleModal(true)}>
            Record Sale
          </Button>
          <a
            href="/api/admin/analytics/export/inventory"
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            Export Inventory CSV
          </a>
          <a
            href="/api/admin/analytics/export/sales"
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            Export Sales CSV
          </a>
        </div>
      </div>

      <OperationalDashboard />

      {/* Overall Profit & Loss */}
      {overallProfit && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Overall Profit & Loss</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-xs text-gray-600 mb-1">Purchase Costs</div>
              <div className="text-2xl font-bold text-red-600">
                £{penceToPounds(overallProfit.purchase_cost_pence)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                £{penceToPounds(overallProfit.revenue_pence)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Consumables</div>
              <div className="text-2xl font-bold text-orange-600">
                £{penceToPounds(overallProfit.consumables_cost_pence)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Costs</div>
              <div className="text-2xl font-bold text-red-600">
                £{penceToPounds(overallProfit.total_costs_pence)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Net Profit/Loss</div>
              <div className={`text-2xl font-bold ${
                overallProfit.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                £{penceToPounds(overallProfit.net_profit_pence)}
              </div>
              <div className={`text-sm mt-1 ${
                overallProfit.margin_percent >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {overallProfit.margin_percent >= 0 ? "+" : ""}{overallProfit.margin_percent.toFixed(1)}% margin
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards - Per Order Averages */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Revenue per Order</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            £{penceToPounds(profitData.length > 0 ? totalRevenue / profitData.length : 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Costs per Order</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            £{penceToPounds(profitData.length > 0 ? totalCosts / profitData.length : 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Profit per Order</div>
          <div className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            £{penceToPounds(profitData.length > 0 ? totalProfit / profitData.length : 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Margin</div>
          <div className={`text-2xl font-bold mt-1 ${avgMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
            {avgMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Sales Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Sales Orders</h2>
        </div>
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : profitData.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No sales yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Buyer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Costs</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Margin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profitData.map((profit) => {
                  const order = salesOrders.find((o) => o.id === profit.sales_order_id);
                  return (
                    <tr key={profit.sales_order_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(profit.sold_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {order?.buyer?.handle ? (
                          <button
                            onClick={() => {
                              // TODO: Navigate to buyer transactions view
                              console.log("View buyer transactions:", order.buyer?.handle);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                          >
                            {order.buyer.handle}
                          </button>
                        ) : (
                          <span className="text-gray-600">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        £{penceToPounds(profit.revenue_after_discount_pence ?? profit.revenue_pence)}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        £{penceToPounds(profit.total_costs_pence)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        profit.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        £{penceToPounds(profit.net_profit_pence)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        profit.margin_percent >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {profit.margin_percent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewOrder(profit.sales_order_id)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && orderProfit && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedOrder(null);
            setOrderProfit(null);
          }}
          title="Order Profit Breakdown"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  £{penceToPounds(orderProfit.revenue_pence)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Net Profit</div>
                <div className={`text-2xl font-bold mt-1 ${
                  orderProfit.net_profit_pence >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  £{penceToPounds(orderProfit.net_profit_pence)}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Revenue Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>£{penceToPounds(orderProfit.revenue_pence)}</span>
                </div>
                {(orderProfit.discount_pence || 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-£{penceToPounds(orderProfit.discount_pence || 0)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-medium">
                  <span>Total Revenue:</span>
                  <span className="text-green-600">£{penceToPounds(orderProfit.revenue_after_discount_pence ?? orderProfit.revenue_pence)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Cost Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fees:</span>
                  <span>£{penceToPounds(orderProfit.fees_pence || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span>£{penceToPounds(orderProfit.shipping_pence || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Consumables:</span>
                  <span>£{penceToPounds(orderProfit.consumables_cost_pence)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-medium">
                  <span>Total Costs:</span>
                  <span className="text-red-600">£{penceToPounds(orderProfit.total_costs_pence)}</span>
                </div>
              </div>
            </div>

            {/* Card Details */}
            {selectedOrder && (() => {
              const order = salesOrders.find((o) => o.id === selectedOrder);
              return order && order.sales_items && order.sales_items.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Cards Sold</h3>
                  <div className="space-y-2 text-sm">
                    {order.sales_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          {item.lot?.card ? (
                            <>
                              <div className="font-medium">
                                #{item.lot.card.number} {item.lot.card.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                Quantity: {item.qty} × £{penceToPounds(item.sold_price_pence)}
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-500">Unknown card</div>
                          )}
                        </div>
                        <div className="font-medium">
                          £{penceToPounds(item.qty * item.sold_price_pence)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {orderProfit.consumables_breakdown && orderProfit.consumables_breakdown.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Consumables Used</h3>
                <div className="space-y-1 text-sm">
                  {orderProfit.consumables_breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-600">
                      <span>{item.consumable_name} × {item.qty} {item.unit}</span>
                      <span>£{penceToPounds(item.total_cost_pence)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Margin:</span>
                <span className={`text-lg font-bold ${
                  orderProfit.margin_percent >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {orderProfit.margin_percent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Sale Modal */}
      <RecordSaleModal
        isOpen={showRecordSaleModal}
        onClose={() => setShowRecordSaleModal(false)}
        onSaleCreated={() => {
          setShowRecordSaleModal(false);
          loadSales();
        }}
      />
    </div>
  );
}

