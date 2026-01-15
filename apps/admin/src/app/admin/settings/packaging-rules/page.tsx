"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";
import { logger } from "@/lib/logger";

type Consumable = {
  consumable_id: string;
  name: string;
  unit: string;
};

type RuleItem = {
  id: string;
  consumable_id: string;
  qty: number;
  consumables: {
    id: string;
    name: string;
    unit: string;
  };
};

type PackagingRule = {
  id: string;
  name: string;
  is_default: boolean;
  card_count_min: number;
  card_count_max: number | null;
  packaging_rule_items: RuleItem[];
};

export default function PackagingRulesPage() {
  const [rules, setRules] = useState<PackagingRule[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState<PackagingRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ruleId: string | null }>({
    isOpen: false,
    ruleId: null,
  });

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [cardCountMin, setCardCountMin] = useState<string>("1");
  const [cardCountMax, setCardCountMax] = useState<string>("");
  const [ruleItems, setRuleItems] = useState<Array<{ consumable_id: string; qty: string }>>([]);

  useEffect(() => {
    loadRules();
    loadConsumables();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packaging-rules");
      const json = await res.json();
      if (json.ok) {
        setRules(json.rules || []);
      }
    } catch (e) {
      logger.error("Failed to load packaging rules", e);
    } finally {
      setLoading(false);
    }
  };

  const loadConsumables = async () => {
    try {
      const res = await fetch("/api/admin/consumables");
      const json = await res.json();
      if (json.ok) {
        setConsumables(json.consumables || []);
      }
    } catch (e) {
      logger.error("Failed to load consumables for packaging rules", e);
    }
  };

  const handleAddRuleItem = () => {
    setRuleItems([...ruleItems, { consumable_id: "", qty: "1" }]);
  };

  const handleRemoveRuleItem = (index: number) => {
    setRuleItems(ruleItems.filter((_, i) => i !== index));
  };

  const handleUpdateRuleItem = (index: number, field: "consumable_id" | "qty", value: string) => {
    const updated = [...ruleItems];
    updated[index] = { ...updated[index], [field]: value };
    setRuleItems(updated);
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim() || !cardCountMin) {
      setErrorModal({ isOpen: true, message: "Please fill in required fields" });
      return;
    }

    const items = ruleItems
      .filter((item) => item.consumable_id && item.qty)
      .map((item) => ({
        consumable_id: item.consumable_id,
        qty: parseInt(item.qty, 10) || 1,
      }));

    if (items.length === 0) {
      setErrorModal({ isOpen: true, message: "Please add at least one consumable to the rule" });
      return;
    }

    setSubmitting(true);
    try {
      const url = editingRule
        ? `/api/admin/packaging-rules/${editingRule.id}`
        : "/api/admin/packaging-rules";
      const method = editingRule ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName.trim(),
          is_default: isDefault,
          card_count_min: parseInt(cardCountMin, 10),
          card_count_max: cardCountMax ? parseInt(cardCountMax, 10) : null,
          items,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || `Failed to ${editingRule ? "update" : "create"} packaging rule`
        );
      }

      setShowAddRule(false);
      resetForm();
      await loadRules();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setErrorModal({
        isOpen: true,
        message: error.message || `Failed to ${editingRule ? "update" : "create"} packaging rule`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteConfirm.ruleId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/packaging-rules/${deleteConfirm.ruleId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete packaging rule");
      }

      setDeleteConfirm({ isOpen: false, ruleId: null });
      await loadRules();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setErrorModal({ isOpen: true, message: error.message || "Failed to delete packaging rule" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRuleName("");
    setIsDefault(false);
    setCardCountMin("1");
    setCardCountMax("");
    setRuleItems([]);
    setEditingRule(null);
  };

  const handleEditRule = (rule: PackagingRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setIsDefault(rule.is_default);
    setCardCountMin(rule.card_count_min.toString());
    setCardCountMax(rule.card_count_max?.toString() || "");
    setRuleItems(
      rule.packaging_rule_items.map((item) => ({
        consumable_id: item.consumable_id,
        qty: item.qty.toString(),
      }))
    );
    setShowAddRule(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Packaging Rules</h1>
          <p className="text-sm text-gray-600 mt-1">
            Define default consumables to apply based on card count
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setShowAddRule(true);
          }}
        >
          Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">No packaging rules yet.</p>
          <p className="text-sm text-gray-400 mb-4">
            Create a default rule to automatically apply consumables when marking items as sold.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setIsDefault(true);
              setShowAddRule(true);
            }}
          >
            Create Default Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{rule.name}</h3>
                    {rule.is_default && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {rule.card_count_min} card{rule.card_count_min !== 1 ? "s" : ""}
                    {rule.card_count_max ? ` - ${rule.card_count_max} cards` : "+"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleEditRule(rule)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDeleteConfirm({ isOpen: true, ruleId: rule.id })}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {rule.packaging_rule_items.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No consumables defined</p>
                ) : (
                  rule.packaging_rule_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{item.consumables?.name || "Unknown"}</span>
                      <span className="text-gray-500">× {item.qty}</span>
                      <span className="text-gray-400 text-xs">
                        ({item.consumables?.unit || "each"})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Rule Modal */}
      <Modal
        isOpen={showAddRule}
        onClose={() => {
          setShowAddRule(false);
          resetForm();
        }}
        title={editingRule ? "Edit Packaging Rule" : "Add Packaging Rule"}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddRule(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRule} disabled={submitting}>
              {submitting ? "Saving..." : "Save Rule"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Rule Name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g., Single Card, Multi-Card"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
              Set as default rule
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Card Count"
              type="number"
              min="1"
              value={cardCountMin}
              onChange={(e) => setCardCountMin(e.target.value)}
            />
            <Input
              label="Max Card Count (optional)"
              type="number"
              min="1"
              value={cardCountMax}
              onChange={(e) => setCardCountMax(e.target.value)}
              placeholder="Leave empty for unlimited"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Consumables</label>
              <Button variant="secondary" size="sm" onClick={handleAddRuleItem}>
                Add Consumable
              </Button>
            </div>
            <div className="space-y-2">
              {ruleItems.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No consumables added</p>
              ) : (
                ruleItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <select
                      value={item.consumable_id}
                      onChange={(e) => handleUpdateRuleItem(index, "consumable_id", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
                    >
                      <option value="">Select consumable...</option>
                      {consumables.map((c) => (
                        <option key={c.consumable_id} value={c.consumable_id}>
                          {c.name} ({c.unit})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleUpdateRuleItem(index, "qty", e.target.value)}
                      className="w-20"
                      placeholder="Qty"
                    />
                    <button
                      onClick={() => handleRemoveRuleItem(index)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, ruleId: null })}
        title="Delete Packaging Rule"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirm({ isOpen: false, ruleId: null })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteRule}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete this packaging rule? This action cannot be undone.
        </p>
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
