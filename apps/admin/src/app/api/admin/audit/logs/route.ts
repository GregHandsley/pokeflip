export const runtime = "edge";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { getAllAuditLogs, getAuditLogs, AuditEntityType, AuditActionType } from "@/lib/audit";

/**
 * GET /api/admin/audit/logs
 *
 * Query parameters:
 * - entityType: Filter by entity type (e.g., "sales_order", "inventory_lot")
 * - entityId: Filter by entity ID (UUID)
 * - actionType: Filter by action type (e.g., "create_sale", "update_price")
 * - userId: Filter by user ID
 * - limit: Maximum number of logs to return (default: 100, max: 1000)
 * - offset: Offset for pagination (default: 0)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") as AuditEntityType | null;
    const entityId = url.searchParams.get("entityId");
    const actionType = url.searchParams.get("actionType");
    const userId = url.searchParams.get("userId");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 1000) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // If both entityType and entityId are provided, use getAuditLogs for entity-specific query
    if (entityType && entityId) {
      const logs = await getAuditLogs(entityType, entityId, limit);
      return NextResponse.json({
        ok: true,
        data: logs,
        count: logs.length,
      });
    }

    // Otherwise, use getAllAuditLogs with filters
    const result = await getAllAuditLogs({
      userId: userId || undefined,
      actionType: (actionType as AuditActionType) || undefined,
      entityType: entityType || undefined,
      limit,
      offset,
    });

    // Check if result is empty due to missing table (would return empty array but we can check error)
    if (result.data.length === 0 && result.count === 0) {
      // This could mean table doesn't exist, but we can't distinguish from truly empty
      // The error should have been logged by getAllAuditLogs
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
      count: result.count,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorWithCode = error as { code?: string };
    const errorCode = errorWithCode?.code;

    // Check if it's a table not found error
    if (
      errorCode === "AUDIT_TABLE_NOT_FOUND" ||
      errorMessage.includes("AUDIT_TABLE_NOT_FOUND") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("relation") ||
      errorMessage.includes("Could not find")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUDIT_TABLE_NOT_FOUND",
          message:
            "Audit log table does not exist. Please run the migration: supabase/migrations/20260111000000_add_audit_log.sql",
          hint: "Run: supabase migration up or apply the migration manually via Supabase dashboard",
        },
        { status: 503 }
      );
    }

    return handleApiError(req, error, {
      operation: "get_audit_logs",
    });
  }
}
