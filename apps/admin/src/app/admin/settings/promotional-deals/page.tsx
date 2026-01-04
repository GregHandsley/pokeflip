"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { penceToPounds } from "@pokeflip/shared";

type PromotionalDeal = {
  id: string;
  name: string;
  description: string | null;
  deal_type: "percentage_off" | "fixed_off" | "free_shipping" | "buy_x_get_y";
  discount_percent: number | null;
  discount_amount_pence: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_card_count: number;
  max_card_count: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function PromotionalDealsPage() {
  const [deals, setDeals] = useState<PromotionalDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<PromotionalDeal | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    deal_type: "percentage_off" as PromotionalDeal["deal_type"],
    discount_percent: "",
    discount_amount_pence: "",
    buy_quantity: "",
    get_quantity: "",
    min_card_count: "1",
    max_card_count: "",
    is_active: true,
  });

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotional-deals?activeOnly=false");
      const json = await res.json();
      if (json.ok) {
        setDeals(json.deals || []);
      }
    } catch (e) {
      console.error("Failed to load deals:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDeal(null);
    setFormData({
      name: "",
      description: "",
      deal_type: "percentage_off",
      discount_percent: "",
      discount_amount_pence: "",
      buy_quantity: "",
      get_quantity: "",
      min_card_count: "1",
      max_card_count: "",
      is_active: true,
    });
    setShowCreateModal(true);
  };

  const handleEdit = (deal: PromotionalDeal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name,
      description: deal.description || "",
      deal_type: deal.deal_type,
      discount_percent: deal.discount_percent?.toString() || "",
      discount_amount_pence: deal.discount_amount_pence?.toString() || "",
      buy_quantity: deal.buy_quantity?.toString() || "",
      get_quantity: deal.get_quantity?.toString() || "",
      min_card_count: deal.min_card_count.toString(),
      max_card_count: deal.max_card_count?.toString() || "",
      is_active: deal.is_active,
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a deal name");
      return;
    }

    try {
      const url = editingDeal
        ? `/api/admin/promotional-deals/${editingDeal.id}`
        : "/api/admin/promotional-deals";
      const method = editingDeal ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save deal");
      }

      setShowCreateModal(false);
      loadDeals();
    } catch (e: any) {
      alert(e.message || "Failed to save deal");
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;

    try {
      const res = await fetch(`/api/admin/promotional-deals/${dealId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete deal");
      }

      loadDeals();
    } catch (e: any) {
      alert(e.message || "Failed to delete deal");
    }
  };

  const toggleActive = async (deal: PromotionalDeal) => {
    try {
      const res = await fetch(`/api/admin/promotional-deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !deal.is_active }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update deal");
      }

      loadDeals();
    } catch (e: any) {
      alert(e.message || "Failed to update deal");
    }
  };

  const getDealDescription = (deal: PromotionalDeal) => {
    switch (deal.deal_type) {
      case "percentage_off":
        return `${deal.discount_percent}% off`;
      case "fixed_off":
        return `£${penceToPounds(deal.discount_amount_pence || 0)} off`;
      case "free_shipping":
        return "Free shipping";
      case "buy_x_get_y":
        if (deal.discount_percent === 100) {
          return `Buy ${deal.buy_quantity}, get ${deal.get_quantity} free`;
        }
        return `Buy ${deal.buy_quantity}, get ${deal.get_quantity} at ${deal.discount_percent}% off`;
      default:
        return "";
    }
  };

  return (
    <div>
      <PageHeader title="Promotional Deals" />
      <p className="text-sm text-gray-600 mb-6">
        Create and manage promotional deals that can be applied to sales.
      </p>

      <div className="mb-4">
        <Button variant="primary" onClick={handleCreate}>
          Create Deal
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading deals...</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No deals created yet</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Card Count</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{deal.name}</div>
                      {deal.description && (
                        <div className="text-xs text-gray-500 mt-1">{deal.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {deal.deal_type === "percentage_off" && "Percentage Off"}
                      {deal.deal_type === "fixed_off" && "Fixed Amount Off"}
                      {deal.deal_type === "free_shipping" && "Free Shipping"}
                      {deal.deal_type === "buy_x_get_y" && "Buy X Get Y"}
                    </td>
                    <td className="px-4 py-3 text-sm">{getDealDescription(deal)}</td>
                    <td className="px-4 py-3 text-sm">
                      {deal.min_card_count}
                      {deal.max_card_count ? ` - ${deal.max_card_count}` : "+"} cards
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleActive(deal)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          deal.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {deal.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(deal)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(deal.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingDeal ? "Edit Deal" : "Create Deal"}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editingDeal ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deal Name *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Buy 3 Get 10% Off"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deal Type *
            </label>
            <select
              value={formData.deal_type}
              onChange={(e) => setFormData({ ...formData, deal_type: e.target.value as PromotionalDeal["deal_type"] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="percentage_off">Percentage Off</option>
              <option value="fixed_off">Fixed Amount Off</option>
              <option value="free_shipping">Free Shipping</option>
              <option value="buy_x_get_y">Buy X Get Y</option>
            </select>
          </div>

          {formData.deal_type === "percentage_off" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Percentage *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_percent}
                onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                placeholder="e.g., 10 for 10% off"
                className="w-full"
              />
            </div>
          )}

          {formData.deal_type === "fixed_off" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Amount (£) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.discount_amount_pence ? penceToPounds(parseInt(formData.discount_amount_pence, 10)) : ""}
                onChange={(e) => {
                  const pounds = parseFloat(e.target.value) || 0;
                  setFormData({ ...formData, discount_amount_pence: Math.round(pounds * 100).toString() });
                }}
                placeholder="e.g., 1.00 for £1 off"
                className="w-full"
              />
            </div>
          )}

          {formData.deal_type === "buy_x_get_y" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buy Quantity *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.buy_quantity}
                    onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                    placeholder="e.g., 3"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Get Quantity *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.get_quantity}
                    onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                    placeholder="e.g., 1"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount % *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    placeholder="e.g., 10 or 100"
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                <strong>100% off = Free:</strong> Buy 5, Get 2 at 100% off = Customer adds 5 cards, 2 of those 5 are free (pays for 3, gets 2 free)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Partial discount:</strong> Buy 3, Get 1 at 10% off = Customer adds 3 cards, 1 of those 3 gets 10% off
              </p>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Card Count
              </label>
              <Input
                type="number"
                min="1"
                value={formData.min_card_count}
                onChange={(e) => setFormData({ ...formData, min_card_count: e.target.value })}
                placeholder="e.g., 3"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Card Count (optional)
              </label>
              <Input
                type="number"
                min="1"
                value={formData.max_card_count}
                onChange={(e) => setFormData({ ...formData, max_card_count: e.target.value })}
                placeholder="Leave empty for unlimited"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (deal can be applied to sales)
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}

