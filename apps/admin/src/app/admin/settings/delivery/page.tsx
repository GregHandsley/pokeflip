"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ErrorModal from "@/components/ui/ErrorModal";
import { logger } from "@/lib/logger";
import { useToast } from "@/contexts/ToastContext";

export default function DeliverySettingsPage() {
  const { showSuccess } = useToast();
  const [deliveryCost, setDeliveryCost] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  useEffect(() => {
    loadDeliveryCost();
  }, []);

  const loadDeliveryCost = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/delivery-cost");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load delivery cost");
      }
      setDeliveryCost(json.deliveryCostGbp?.toString() || "0");
    } catch (e) {
      logger.error("Failed to load delivery cost", e);
      setErrorModal({
        isOpen: true,
        message: e instanceof Error ? e.message : "Failed to load delivery cost",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const cost = parseFloat(deliveryCost);
    if (isNaN(cost) || cost < 0) {
      setErrorModal({
        isOpen: true,
        message: "Please enter a valid non-negative number",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/delivery-cost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryCostGbp: cost }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save delivery cost");
      }

      // Show success feedback
      showSuccess("Delivery cost saved successfully!");
    } catch (e) {
      logger.error("Failed to save delivery cost", e);
      setErrorModal({
        isOpen: true,
        message: e instanceof Error ? e.message : "Failed to save delivery cost",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading delivery settings...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Delivery Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure the standard delivery cost that will be used for profit calculations in the
            sales flow.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standard Delivery Cost (£)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
                placeholder="0.00"
                className="w-48"
              />
              <p className="text-xs text-gray-500 mt-1">
                This cost will be included in profit calculations when pricing cards in the sales
                flow.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </>
  );
}
