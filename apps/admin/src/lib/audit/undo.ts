import { supabaseServer } from "@/lib/supabase/server";
import { createApiLogger } from "@/lib/logger";
import { getAuditLogById, logAudit, AuditActionType, AuditEntityType } from "./audit-log";
import type { AuditLogRecord } from "./audit-log";

export interface UndoResult {
  success: boolean;
  message: string;
  auditLogId?: string;
  error?: string;
}

/**
 * Undo a specific audit log entry by restoring old_values
 * @param auditLogId The ID of the audit log entry to undo
 * @param userId Optional user ID performing the undo (for audit trail)
 * @param userEmail Optional user email performing the undo (for audit trail)
 * @returns Undo result
 */
export async function undoAuditLog(
  auditLogId: string,
  userId?: string,
  userEmail?: string
): Promise<UndoResult> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    // Get the audit log entry
    const auditLog = await getAuditLogById(auditLogId);

    if (!auditLog) {
      return {
        success: false,
        message: "Audit log entry not found",
        error: "NOT_FOUND",
      };
    }

    // Check if undo is possible (need old_values)
    if (!auditLog.old_values || Object.keys(auditLog.old_values).length === 0) {
      return {
        success: false,
        message: "Cannot undo: no previous state available",
        error: "NO_OLD_VALUES",
      };
    }

    // Map entity types to table names
    const tableMap: Record<AuditEntityType, string> = {
      sales_order: "sales_orders",
      sales_item: "sales_items",
      inventory_lot: "inventory_lots",
      bundle: "bundles",
      acquisition: "acquisitions",
      intake_line: "intake_lines",
      other: "unknown",
    };

    const tableName = tableMap[auditLog.entity_type];

    if (tableName === "unknown") {
      return {
        success: false,
        message: `Cannot undo: unknown entity type ${auditLog.entity_type}`,
        error: "UNKNOWN_ENTITY_TYPE",
      };
    }

    // Restore old values to the entity
    const { error: updateError } = await supabase
      .from(tableName)
      .update(auditLog.old_values as any)
      .eq("id", auditLog.entity_id);

    if (updateError) {
      logger.error("Failed to undo audit log entry", updateError, undefined, {
        operation: "undo_audit_log",
        auditLogId,
        entityType: auditLog.entity_type,
        entityId: auditLog.entity_id,
      });

      return {
        success: false,
        message: `Failed to restore previous state: ${updateError.message}`,
        error: "UPDATE_FAILED",
      };
    }

    // Format user-friendly action description
    const actionLabels: Record<string, string> = {
      create_sale: "Sale Creation",
      update_price: "Price Update",
      change_status: "Status Change",
      update_lot: "Item Update",
      delete_lot: "Item Deletion",
      split_lot: "Item Split",
      merge_lots: "Item Merge",
      update_bundle: "Bundle Update",
      delete_bundle: "Bundle Deletion",
      create_acquisition: "Purchase Creation",
      update_acquisition: "Purchase Update",
      other: "Previous Action",
    };
    const actionLabel = actionLabels[auditLog.action_type] || auditLog.action_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    // Log the undo action
    await logAudit({
      user_id: userId || null,
      user_email: userEmail || null,
      action_type: "other", // Could add "undo" action type later
      entity_type: auditLog.entity_type,
      entity_id: auditLog.entity_id,
      old_values: auditLog.new_values || null, // Current state (before undo)
      new_values: auditLog.old_values, // State after undo (restored)
      description: `Reverted: ${actionLabel}`,
    });

    return {
      success: true,
      message: `Successfully undone ${auditLog.action_type} on ${auditLog.entity_type}`,
      auditLogId: auditLog.id,
    };
  } catch (error) {
    logger.error("Error undoing audit log entry", error instanceof Error ? error : new Error(String(error)), undefined, {
      operation: "undo_audit_log",
      auditLogId,
    });

    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error: "UNEXPECTED_ERROR",
    };
  }
}

/**
 * Check if an audit log entry can be undone
 * @param auditLogId The ID of the audit log entry
 * @returns True if undo is possible, false otherwise
 */
export async function canUndoAuditLog(auditLogId: string): Promise<boolean> {
  try {
    const auditLog = await getAuditLogById(auditLogId);

    if (!auditLog) {
      return false;
    }

    // Can undo if old_values exist and entity still exists
    if (!auditLog.old_values || Object.keys(auditLog.old_values).length === 0) {
      return false;
    }

    // Check if entity still exists
    const tableMap: Record<AuditEntityType, string> = {
      sales_order: "sales_orders",
      sales_item: "sales_items",
      inventory_lot: "inventory_lots",
      bundle: "bundles",
      acquisition: "acquisitions",
      intake_line: "intake_lines",
      other: "unknown",
    };

    const tableName = tableMap[auditLog.entity_type];

    if (tableName === "unknown") {
      return false;
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from(tableName)
      .select("id")
      .eq("id", auditLog.entity_id)
      .single();

    if (error || !data) {
      return false; // Entity doesn't exist anymore
    }

    return true;
  } catch (error) {
    return false;
  }
}

