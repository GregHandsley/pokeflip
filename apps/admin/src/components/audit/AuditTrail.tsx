"use client";

import { useState, useEffect } from "react";
import { AuditLogRecord, AuditActionType, AuditEntityType } from "@/lib/audit/audit-log";
import Button from "@/components/ui/Button";

interface AuditTrailProps {
  entityType?: AuditEntityType;
  entityId?: string;
  showEntityFilter?: boolean;
  onUndo?: (auditLogId: string) => void;
}

export default function AuditTrail({
  entityType,
  entityId,
  showEntityFilter = false,
  onUndo,
}: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    entityType?: AuditEntityType;
    entityId?: string;
    actionType?: AuditActionType;
    limit: number;
  }>({
    entityType,
    entityId,
    limit: 100,
  });
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (filters.entityType) {
        params.append("entityType", filters.entityType);
      }
      if (filters.entityId) {
        params.append("entityId", filters.entityId);
      }
      if (filters.actionType) {
        params.append("actionType", filters.actionType);
      }
      params.append("limit", filters.limit.toString());

      const response = await fetch(`/api/admin/audit/logs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        // Check if it's a table not found error
        if (data.error === "AUDIT_TABLE_NOT_FOUND" || data.message?.includes("does not exist")) {
          throw new Error(
            "Audit log table does not exist. Please run the migration:\n" +
            "supabase/migrations/20260111000000_add_audit_log.sql\n\n" +
            "Run: supabase migration up or apply the migration manually via Supabase dashboard"
          );
        }
        throw new Error(data.message || data.error || "Failed to load audit logs");
      }

      setLogs(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const handleUndo = async (auditLogId: string) => {
    if (undoingIds.has(auditLogId)) {
      return;
    }

    setUndoingIds((prev) => new Set(prev).add(auditLogId));

    try {
      const response = await fetch("/api/admin/audit/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogId }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to undo action");
      }

      // Reload logs after undo
      await loadLogs();

      // Call onUndo callback if provided
      if (onUndo) {
        onUndo(auditLogId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to undo action");
    } finally {
      setUndoingIds((prev) => {
        const next = new Set(prev);
        next.delete(auditLogId);
        return next;
      });
    }
  };

  // User-friendly action type labels
  const getActionLabel = (actionType: string, description?: string | null): string => {
    // Check if this is an undo action
    if (actionType === "other" && description?.startsWith("Reverted:")) {
      return "Action Reverted";
    }
    
    const labels: Record<string, string> = {
      create_sale: "Sale Created",
      update_price: "Price Updated",
      change_status: "Status Changed",
      update_lot: "Item Updated",
      delete_lot: "Item Deleted",
      split_lot: "Item Split",
      merge_lots: "Items Merged",
      update_bundle: "Bundle Updated",
      delete_bundle: "Bundle Deleted",
      create_acquisition: "Purchase Added",
      update_acquisition: "Purchase Updated",
      other: "Action Performed",
    };
    return labels[actionType] || actionType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // User-friendly entity type labels
  const getEntityLabel = (entityType: string): string => {
    const labels: Record<string, string> = {
      sales_order: "Sale",
      sales_item: "Sale Item",
      inventory_lot: "Inventory Item",
      bundle: "Bundle",
      acquisition: "Purchase",
      intake_line: "Purchase Item",
      other: "Item",
    };
    return labels[entityType] || entityType.replace(/_/g, " ");
  };

  // Format date in a relative, user-friendly way
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else {
      // For older dates, show the actual date
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  // Format values in a user-friendly way instead of raw JSON
  const formatValues = (values: Record<string, unknown> | null): string => {
    if (!values || Object.keys(values).length === 0) {
      return "None";
    }

    const parts: string[] = [];

    // Format status
    if (values.status) {
      const statusLabels: Record<string, string> = {
        draft: "Draft",
        ready: "Ready",
        listed: "Listed",
        sold: "Sold",
        archived: "Archived",
      };
      parts.push(`Status: ${statusLabels[values.status as string] || values.status}`);
    }

    // Format price
    if (values.list_price_pence !== undefined && values.list_price_pence !== null) {
      parts.push(`Price: £${((values.list_price_pence as number) / 100).toFixed(2)}`);
    } else if (values.sold_price_pence !== undefined && values.sold_price_pence !== null) {
      parts.push(`Sale Price: £${((values.sold_price_pence as number) / 100).toFixed(2)}`);
    }

    // Format for_sale
    if (values.for_sale !== undefined) {
      parts.push(`For Sale: ${values.for_sale ? "Yes" : "No"}`);
    }

    // Format quantities
    if (values.sold_quantity !== undefined && values.sold_quantity !== null) {
      parts.push(`Sold Quantity: ${values.sold_quantity}`);
    }
    if (values.quantity !== undefined && values.quantity !== null) {
      parts.push(`Quantity: ${values.quantity}`);
    }
    if (values.qty !== undefined && values.qty !== null) {
      parts.push(`Quantity: ${values.qty}`);
    }

    // Format buyer info
    if (values.buyer_handle) {
      parts.push(`Buyer: ${values.buyer_handle}`);
    }

    // Format platform
    if (values.platform) {
      parts.push(`Platform: ${String(values.platform).toUpperCase()}`);
    }

    // Format lots array (for sales)
    if (Array.isArray(values.lots) && values.lots.length > 0) {
      const totalQty = values.lots.reduce((sum: number, lot: any) => sum + (lot.qty || 0), 0);
      parts.push(`${values.lots.length} item${values.lots.length > 1 ? "s" : ""} (${totalQty} total)`);
    }

    // Format fees, shipping, discount
    if (values.fees_pence !== undefined && values.fees_pence !== null) {
      parts.push(`Fees: £${((values.fees_pence as number) / 100).toFixed(2)}`);
    }
    if (values.shipping_pence !== undefined && values.shipping_pence !== null) {
      parts.push(`Shipping: £${((values.shipping_pence as number) / 100).toFixed(2)}`);
    }
    if (values.discount_pence !== undefined && values.discount_pence !== null) {
      parts.push(`Discount: £${((values.discount_pence as number) / 100).toFixed(2)}`);
    }

    // If we have formatted some values, return them
    if (parts.length > 0) {
      return parts.join(", ");
    }

    // Fallback: format as readable JSON for other fields
    const remaining: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!["status", "list_price_pence", "sold_price_pence", "for_sale", "sold_quantity", "quantity", "qty", "buyer_handle", "platform"].includes(key)) {
        remaining[key] = value;
      }
    }

    if (Object.keys(remaining).length > 0) {
      // Format remaining fields nicely
      const formatted = Object.entries(remaining)
        .map(([key, val]) => {
          const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          if (typeof val === "object" && val !== null) {
            return `${formattedKey}: ${JSON.stringify(val)}`;
          }
          return `${formattedKey}: ${val}`;
        })
        .join(", ");
      return parts.length > 0 ? `${parts.join(", ")}, ${formatted}` : formatted;
    }

    return parts.join(", ") || "None";
  };

  const canUndo = (log: AuditLogRecord) => {
    return log.old_values && Object.keys(log.old_values).length > 0;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading audit trail...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={loadLogs} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showEntityFilter && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Type
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                value={filters.entityType || ""}
                onChange={(e) =>
                  setFilters({ ...filters, entityType: e.target.value as AuditEntityType || undefined, entityId: undefined })
                }
              >
                <option value="">All Types</option>
                <option value="sales_order">Sales</option>
                <option value="inventory_lot">Inventory Items</option>
                <option value="bundle">Bundles</option>
                <option value="acquisition">Purchases</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                value={filters.actionType || ""}
                onChange={(e) =>
                  setFilters({ ...filters, actionType: e.target.value as AuditActionType || undefined })
                }
              >
                <option value="">All Actions</option>
                <option value="create_sale">Sale Created</option>
                <option value="update_price">Price Updated</option>
                <option value="change_status">Status Changed</option>
                <option value="update_lot">Item Updated</option>
              </select>
            </div>
          </div>
          {filters.entityType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item ID (optional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                placeholder="Enter specific item ID to filter"
                value={filters.entityId || ""}
                onChange={(e) =>
                  setFilters({ ...filters, entityId: e.target.value || undefined })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-lg font-medium mb-2">No activity found</div>
          <div className="text-sm">Try adjusting your filters or perform some actions to see audit logs.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2">
                    <div className="font-semibold text-gray-900 text-base">
                      {getActionLabel(log.action_type, log.description)}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {getEntityLabel(log.entity_type)}
                    </div>
                  </div>
                  {log.description && (
                    <div className="text-sm text-gray-700 mb-2 bg-gray-50 px-2 py-1 rounded">
                      {log.description}
                    </div>
                  )}
                  
                  {/* Changes Summary */}
                  {(log.old_values || log.new_values) && (
                    <div className="mt-2 space-y-1 text-sm">
                      {log.old_values && Object.keys(log.old_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-red-600 min-w-[50px]">Before:</span>
                          <span className="text-gray-700 flex-1">{formatValues(log.old_values)}</span>
                        </div>
                      )}
                      {log.new_values && Object.keys(log.new_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-green-600 min-w-[50px]">After:</span>
                          <span className="text-gray-700 flex-1">{formatValues(log.new_values)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2">
                    {formatDate(log.created_at)}
                    {log.user_email && ` • ${log.user_email}`}
                  </div>
                </div>
                {canUndo(log) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUndo(log.id)}
                    disabled={undoingIds.has(log.id)}
                    className="ml-4"
                  >
                    {undoingIds.has(log.id) ? "Undoing..." : "Undo"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

