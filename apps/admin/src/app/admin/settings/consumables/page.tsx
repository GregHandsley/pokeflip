"use client";

import { useState, useEffect } from "react";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";

type Consumable = {
  consumable_id: string;
  name: string;
  unit: string;
  total_purchased_qty: number;
  total_cost_pence: number;
  avg_cost_pence_per_unit: number;
};

type Purchase = {
  id: string;
  consumable_id: string;
  qty: number;
  total_cost_pence: number;
  purchased_at: string;
  consumables: {
    id: string;
    name: string;
    unit: string;
  };
};

export default function ConsumablesPage() {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddConsumable, setShowAddConsumable] = useState(false);
  const [showEditConsumable, setShowEditConsumable] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: "" });
  
  // Add/Edit consumable form
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableUnit, setNewConsumableUnit] = useState("each");
  const [editingConsumableId, setEditingConsumableId] = useState<string | null>(null);
  
  // Add purchase form
  const [purchaseConsumableId, setPurchaseConsumableId] = useState("");
  const [purchaseQty, setPurchaseQty] = useState<string>("");
  const [purchaseCost, setPurchaseCost] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadConsumables();
    loadPurchases();
  }, []);

  const loadConsumables = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/consumables");
      const json = await res.json();
      if (json.ok) {
        setConsumables(json.consumables || []);
      }
    } catch (e) {
      console.error("Failed to load consumables:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await fetch("/api/admin/consumables/purchases");
      const json = await res.json();
      if (json.ok) {
        setPurchases(json.purchases || []);
      }
    } catch (e) {
      console.error("Failed to load purchases:", e);
    }
  };

  const handleAddConsumable = async () => {
    if (!newConsumableName.trim()) {
      setErrorModal({ isOpen: true, message: "Please enter a consumable name" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/consumables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newConsumableName.trim(),
          unit: newConsumableUnit.trim() || "each",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create consumable");
      }

      setShowAddConsumable(false);
      setNewConsumableName("");
      setNewConsumableUnit("each");
      await loadConsumables();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to create consumable" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditConsumable = (consumable: Consumable) => {
    setEditingConsumableId(consumable.consumable_id);
    setNewConsumableName(consumable.name);
    setNewConsumableUnit(consumable.unit);
    setShowEditConsumable(true);
  };

  const handleSaveEditConsumable = async () => {
    if (!newConsumableName.trim()) {
      setErrorModal({ isOpen: true, message: "Please enter a consumable name" });
      return;
    }

    if (!editingConsumableId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/consumables/${editingConsumableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newConsumableName.trim(),
          unit: newConsumableUnit.trim() || "each",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update consumable");
      }

      setShowEditConsumable(false);
      setEditingConsumableId(null);
      setNewConsumableName("");
      setNewConsumableUnit("each");
      await loadConsumables();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to update consumable" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPurchase = async () => {
    if (!purchaseConsumableId || !purchaseQty || !purchaseCost) {
      setErrorModal({ isOpen: true, message: "Please fill in all fields" });
      return;
    }

    const qty = parseInt(purchaseQty, 10);
    const costPence = Math.round(parseFloat(purchaseCost) * 100);

    if (qty <= 0 || costPence < 0) {
      setErrorModal({ isOpen: true, message: "Quantity and cost must be positive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/consumables/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumable_id: purchaseConsumableId,
          qty,
          total_cost_pence: costPence,
          purchased_at: purchaseDate,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to record purchase");
      }

      setShowAddPurchase(false);
      setPurchaseConsumableId("");
      setPurchaseQty("");
      setPurchaseCost("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      await loadConsumables();
      await loadPurchases();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to record purchase" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatUKDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const commonUnits = ["Each", "Pack", "Roll", "Box", "Set"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Consumables Management</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAddPurchase(true)}>
            Record Purchase
          </Button>
          <Button variant="primary" onClick={() => setShowAddConsumable(true)}>
            Add Consumable
          </Button>
        </div>
      </div>

      {/* Consumables List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Consumables</h2>
        </div>
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : consumables.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No consumables yet. Add one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Purchased</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avg Cost/Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {consumables.map((consumable) => (
                  <tr key={consumable.consumable_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{consumable.name}</td>
                    <td className="px-4 py-3 text-gray-600">{consumable.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{consumable.total_purchased_qty}</td>
                    <td className="px-4 py-3 text-gray-600">£{penceToPounds(consumable.total_cost_pence)}</td>
                    <td className="px-4 py-3 font-medium">
                      {consumable.avg_cost_pence_per_unit > 0
                        ? `£${penceToPounds(consumable.avg_cost_pence_per_unit)}`
                        : "No purchases"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleEditConsumable(consumable)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Purchases */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Recent Purchases</h2>
        </div>
        {purchases.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No purchases recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Consumable</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cost/Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.slice(0, 20).map((purchase) => {
                  const unitCost = purchase.total_cost_pence / purchase.qty;
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {formatUKDate(purchase.purchased_at)}
                      </td>
                      <td className="px-4 py-3 font-medium">{purchase.consumables?.name || "Unknown"}</td>
                      <td className="px-4 py-3 text-gray-600">{purchase.qty} {purchase.consumables?.unit || ""}</td>
                      <td className="px-4 py-3 text-gray-600">£{penceToPounds(purchase.total_cost_pence)}</td>
                      <td className="px-4 py-3 font-medium">£{penceToPounds(unitCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Consumable Modal */}
      <Modal
        isOpen={showAddConsumable}
        onClose={() => setShowAddConsumable(false)}
        title="Add Consumable"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAddConsumable(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddConsumable} disabled={submitting}>
              {submitting ? "Adding..." : "Add Consumable"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newConsumableName}
            onChange={(e) => setNewConsumableName(e.target.value)}
            placeholder="e.g., Sleeves, Toploaders, Team Bags"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <div className="flex flex-wrap gap-2">
              {commonUnits.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setNewConsumableUnit(unit)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newConsumableUnit === unit
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
            <Input
              label="Custom Unit (optional)"
              value={!commonUnits.includes(newConsumableUnit) ? newConsumableUnit : ""}
              onChange={(e) => setNewConsumableUnit(e.target.value)}
              placeholder="Enter custom unit"
              className="mt-2"
            />
          </div>
        </div>
      </Modal>

      {/* Add Purchase Modal */}
      <Modal
        isOpen={showAddPurchase}
        onClose={() => setShowAddPurchase(false)}
        title="Record Consumable Purchase"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAddPurchase(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddPurchase} disabled={submitting}>
              {submitting ? "Recording..." : "Record Purchase"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Consumable</label>
            <select
              value={purchaseConsumableId}
              onChange={(e) => setPurchaseConsumableId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
            >
              <option value="">Select consumable...</option>
              {consumables.map((c) => (
                <option key={c.consumable_id} value={c.consumable_id}>
                  {c.name} ({c.unit})
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={purchaseQty}
            onChange={(e) => setPurchaseQty(e.target.value)}
            placeholder="e.g., 100"
          />
          <Input
            label="Total Cost (£)"
            type="number"
            step="0.01"
            min="0"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Purchase Date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
      </Modal>

      {/* Edit Consumable Modal */}
      <Modal
        isOpen={showEditConsumable}
        onClose={() => {
          setShowEditConsumable(false);
          setEditingConsumableId(null);
          setNewConsumableName("");
          setNewConsumableUnit("each");
        }}
        title="Edit Consumable"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditConsumable(false);
                setEditingConsumableId(null);
                setNewConsumableName("");
                setNewConsumableUnit("each");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditConsumable} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newConsumableName}
            onChange={(e) => setNewConsumableName(e.target.value)}
            placeholder="e.g., Sleeves, Toploaders, Team Bags"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <div className="flex flex-wrap gap-2">
              {commonUnits.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setNewConsumableUnit(unit)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newConsumableUnit === unit
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
            <Input
              label="Custom Unit (optional)"
              value={!commonUnits.includes(newConsumableUnit) ? newConsumableUnit : ""}
              onChange={(e) => setNewConsumableUnit(e.target.value)}
              placeholder="Enter custom unit"
              className="mt-2"
            />
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </div>
  );
}

