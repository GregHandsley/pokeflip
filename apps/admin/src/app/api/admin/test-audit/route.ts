export const runtime = "edge";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

/**
 * Test endpoint to verify audit logging works
 * GET /api/admin/test-audit
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: Request) {
  try {
    console.log("[Test Audit] Starting test...");

    const testEntry = {
      user_id: "test-user",
      user_email: "test@example.com",
      action_type: "other" as const,
      entity_type: "other" as const,
      entity_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
      old_values: { test: "old" },
      new_values: { test: "new" },
      description: "Test audit log entry",
      ip_address: null,
      user_agent: null,
    };

    console.log("[Test Audit] Calling logAudit...");
    const result = await logAudit(testEntry);

    if (result) {
      console.log("[Test Audit] Success! Audit log created:", result.id);
      return NextResponse.json({
        ok: true,
        message: "Audit log created successfully",
        auditLogId: result.id,
      });
    } else {
      console.error("[Test Audit] Failed - logAudit returned null");
      return NextResponse.json(
        {
          ok: false,
          message: "Audit log failed - check server logs for errors",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Test Audit] Exception:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Test failed - check server logs",
      },
      { status: 500 }
    );
  }
}
