import { NextResponse } from "next/server";
import { handleApiError, createErrorResponse } from "@/lib/api-error-handler";
import { undoAuditLog, canUndoAuditLog, getCurrentUser } from "@/lib/audit";
import { nonEmptyString, uuid } from "@/lib/validation";

/**
 * POST /api/admin/audit/undo
 *
 * Body:
 * - auditLogId: The ID of the audit log entry to undo (required)
 */
export async function POST(req: Request) {
  // Get current user for audit logging
  const userInfo = await getCurrentUser(req);

  try {
    const body = await req.json();
    const auditLogId = nonEmptyString(body.auditLogId, "auditLogId");

    // Validate UUID format
    uuid(auditLogId, "auditLogId");

    // Check if undo is possible
    const canUndo = await canUndoAuditLog(auditLogId);

    if (!canUndo) {
      return createErrorResponse(
        "Cannot undo this action: either the audit log entry doesn't exist, has no previous state, or the entity no longer exists",
        400,
        "CANNOT_UNDO"
      );
    }

    // Perform undo
    const result = await undoAuditLog(
      auditLogId,
      userInfo?.userId || undefined,
      userInfo?.userEmail || undefined
    );

    if (!result.success) {
      return createErrorResponse(result.message, 500, result.error || "UNDO_FAILED");
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      auditLogId: result.auditLogId,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "undo_audit_log",
    });
  }
}

/**
 * GET /api/admin/audit/undo?auditLogId=...
 *
 * Check if an audit log entry can be undone
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const auditLogId = url.searchParams.get("auditLogId");

    if (!auditLogId) {
      return createErrorResponse(
        "auditLogId query parameter is required",
        400,
        "MISSING_AUDIT_LOG_ID"
      );
    }

    // Validate UUID format
    uuid(auditLogId, "auditLogId");

    const canUndo = await canUndoAuditLog(auditLogId);

    return NextResponse.json({
      ok: true,
      canUndo,
    });
  } catch (error: unknown) {
    return handleApiError(req, error, {
      operation: "check_undo_audit_log",
    });
  }
}
