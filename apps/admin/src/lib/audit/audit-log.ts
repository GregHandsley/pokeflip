import { supabaseServer } from "@/lib/supabase/server";
import { createApiLogger } from "@/lib/logger";

/**
 * Action types that can be audited
 */
export type AuditActionType =
  | "create_sale"
  | "update_price"
  | "change_status"
  | "update_lot"
  | "delete_lot"
  | "split_lot"
  | "merge_lots"
  | "update_bundle"
  | "delete_bundle"
  | "create_acquisition"
  | "update_acquisition"
  | "other";

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | "sales_order"
  | "sales_item"
  | "inventory_lot"
  | "bundle"
  | "acquisition"
  | "intake_line"
  | "other";

export interface AuditLogEntry {
  user_id?: string | null;
  user_email?: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id: string; // UUID as string
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string;
  created_at: string;
}

/**
 * Log an audit entry
 * @param entry The audit log entry to record
 * @returns The created audit log record, or null if logging fails
 */
export async function logAudit(entry: AuditLogEntry): Promise<AuditLogRecord | null> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    // Insert audit log entry
    const { data, error } = await supabase
      .from("audit_log")
      .insert({
        user_id: entry.user_id || null,
        user_email: entry.user_email || null,
        action_type: entry.action_type,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        old_values: entry.old_values ? (entry.old_values as any) : null,
        new_values: entry.new_values ? (entry.new_values as any) : null,
        description: entry.description || null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
      })
      .select()
      .single();

    if (error) {
      const errorMessage = error.message || String(error);
      const errorCode = (error as any).code;
      logger.error(
        `Failed to log audit entry: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage),
        undefined,
        {
          operation: "log_audit",
          entry: entry,
          errorCode,
        }
      );
      return null;
    }

    return data as AuditLogRecord;
  } catch (error) {
    logger.error("Error logging audit entry", error instanceof Error ? error : new Error(String(error)), undefined, {
      operation: "log_audit",
      entry: entry,
    });
    return null;
  }
}

/**
 * Get audit logs for a specific entity
 * @param entityType The type of entity
 * @param entityId The ID of the entity
 * @param limit Maximum number of logs to return (default: 100)
 * @returns Array of audit log records
 */
export async function getAuditLogs(
  entityType: AuditEntityType,
  entityId: string,
  limit: number = 100
): Promise<AuditLogRecord[]> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const errorMessage = error.message || String(error);
      const errorCode = (error as any).code;
      logger.error(
        `Failed to fetch audit logs: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage),
        undefined,
        {
          operation: "get_audit_logs",
          entityType,
          entityId,
          errorCode,
        }
      );
      return [];
    }

    return (data || []) as AuditLogRecord[];
  } catch (error) {
    logger.error("Error fetching audit logs", error instanceof Error ? error : new Error(String(error)), undefined, {
      operation: "get_audit_logs",
      entityType,
      entityId,
    });
    return [];
  }
}

/**
 * Get all audit logs with optional filtering
 * @param filters Optional filters
 * @returns Array of audit log records
 */
export async function getAllAuditLogs(filters?: {
  userId?: string;
  actionType?: AuditActionType;
  entityType?: AuditEntityType;
  limit?: number;
  offset?: number;
}): Promise<{ data: AuditLogRecord[]; count: number }> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" });

    if (filters?.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters?.actionType) {
      query = query.eq("action_type", filters.actionType);
    }

    if (filters?.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }

    query = query.order("created_at", { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 100) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      // Better error logging - check if table doesn't exist
      const errorMessage = error.message || String(error);
      const errorCode = (error as any).code;
      const isTableNotFound = errorMessage.includes("does not exist") || 
                             errorMessage.includes("relation") ||
                             errorMessage.includes("Could not find") ||
                             errorCode === "42P01"; // PostgreSQL relation does not exist
      
      if (isTableNotFound) {
        logger.error(
          "Audit log table does not exist. Please run the migration: supabase/migrations/20260111000000_add_audit_log.sql",
          new Error(errorMessage),
          undefined,
          {
            operation: "get_all_audit_logs",
            filters,
            errorCode,
            hint: "Run: supabase migration up or apply the migration manually",
          }
        );
        // Throw a specific error so the API can handle it properly
        const tableNotFoundError = new Error("AUDIT_TABLE_NOT_FOUND: Audit log table does not exist. Please run the migration: supabase/migrations/20260111000000_add_audit_log.sql");
        (tableNotFoundError as any).code = "AUDIT_TABLE_NOT_FOUND";
        (tableNotFoundError as any).originalError = error;
        throw tableNotFoundError;
      } else {
        logger.error("Failed to fetch audit logs", error instanceof Error ? error : new Error(errorMessage), undefined, {
          operation: "get_all_audit_logs",
          filters,
          errorCode,
        });
      }
      return { data: [], count: 0 };
    }

    return {
      data: (data || []) as AuditLogRecord[],
      count: count || 0,
    };
  } catch (error) {
    logger.error("Error fetching audit logs", error instanceof Error ? error : new Error(String(error)), undefined, {
      operation: "get_all_audit_logs",
      filters,
    });
    return { data: [], count: 0 };
  }
}

/**
 * Get an audit log entry by ID (for undo operations)
 * @param auditLogId The ID of the audit log entry
 * @returns The audit log record, or null if not found
 */
export async function getAuditLogById(auditLogId: string): Promise<AuditLogRecord | null> {
  const supabase = supabaseServer();
  const logger = createApiLogger(new Request("http://localhost"));

  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("id", auditLogId)
      .single();

    if (error) {
      logger.error("Failed to fetch audit log", error, undefined, {
        operation: "get_audit_log_by_id",
        auditLogId,
      });
      return null;
    }

    return data as AuditLogRecord;
  } catch (error) {
    logger.error("Error fetching audit log", error instanceof Error ? error : new Error(String(error)), undefined, {
      operation: "get_audit_log_by_id",
      auditLogId,
    });
    return null;
  }
}

