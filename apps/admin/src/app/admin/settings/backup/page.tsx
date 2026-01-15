"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { logger } from "@/lib/logger";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";

type BackupStatus = {
  lastExport?: string;
  lastExportSize?: string;
  supabaseBackupsEnabled?: boolean;
  lastSupabaseBackup?: string;
};

export default function BackupPage() {
  const { handleError } = useApiErrorHandler();
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({});

  const handleFullExport = async () => {
    setExporting(true);
    try {
      const url = `/api/admin/backup/full-export?format=${exportFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Export failed");
      }

      // Create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      const timestamp = new Date().toISOString().split("T")[0];
      const extension = exportFormat === "json" ? "json" : "csv";
      link.download = `pokeflip-full-export-${timestamp}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Update status
      setBackupStatus({
        ...backupStatus,
        lastExport: new Date().toISOString(),
        lastExportSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      });

      logger.info("Full export completed successfully", undefined, {
        format: exportFormat,
        size: blob.size,
      });
    } catch (error: unknown) {
      logger.error("Failed to export data", error);
      handleError(error);
    } finally {
      setExporting(false);
    }
  };

  const handleSalesExport = () => {
    window.location.href = "/api/admin/analytics/export/sales";
  };

  const handleInventoryExport = () => {
    window.location.href = "/api/admin/analytics/export/inventory";
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Backup & Recovery"
        description="Manage database backups, exports, and recovery procedures"
      />

      {/* Backup Information */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Backup Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Supabase Automated Backups</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">Enabled (Pro Plan)</span>
              </div>
              <div className="text-xs text-gray-500 ml-4">
                Daily backups with 7-day retention. Managed by Supabase.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Last Manual Export</div>
              {backupStatus.lastExport ? (
                <div className="text-sm">
                  <div className="font-medium">
                    {new Date(backupStatus.lastExport).toLocaleString()}
                  </div>
                  {backupStatus.lastExportSize && (
                    <div className="text-xs text-gray-500">Size: {backupStatus.lastExportSize}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No exports yet</div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold mb-2">Backup Schedule</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                • <strong>Automated:</strong> Daily (Supabase Pro Plan)
              </li>
              <li>
                • <strong>Manual:</strong> On-demand via exports below
              </li>
              <li>
                • <strong>Recommended:</strong> Weekly full export + daily automated backups
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Full Database Export */}
      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Full Database Export</h2>
            <p className="text-sm text-gray-600">
              Export all application data including acquisitions, inventory, sales, bundles, and
              more. This creates a complete snapshot of your data.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "csv" | "json")}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={exporting}
              >
                <option value="csv">CSV (Comma-separated)</option>
                <option value="json">JSON (Structured)</option>
              </select>
            </div>

            <div className="shrink-0">
              <Button variant="primary" onClick={handleFullExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Download Full Export"}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Full exports include all critical data tables. JSON format
              preserves relationships and structure better for restoration. CSV format is better for
              analysis in spreadsheet applications.
            </p>
          </div>
        </div>
      </Card>

      {/* Partial Exports */}
      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Partial Data Exports</h2>
            <p className="text-sm text-gray-600">
              Export specific data sets for analysis or reporting purposes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="font-medium mb-1">Sales Export</h3>
                <p className="text-sm text-gray-600">
                  All sales orders with profit calculations, buyer information, and item details.
                </p>
              </div>
              <Button variant="secondary" onClick={handleSalesExport} className="w-full">
                Export Sales CSV
              </Button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="font-medium mb-1">Inventory Export</h3>
                <p className="text-sm text-gray-600">
                  All inventory lots with card details, conditions, quantities, and pricing.
                </p>
              </div>
              <Button variant="secondary" onClick={handleInventoryExport} className="w-full">
                Export Inventory CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Recovery Information */}
      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Recovery Procedures</h2>
            <p className="text-sm text-gray-600 mb-4">
              Information about restoring data from backups.
            </p>
          </div>

          <div className="space-y-3">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-sm mb-1">Supabase Automated Backups</h3>
              <p className="text-sm text-gray-600 mb-2">
                Restore from Supabase Dashboard: Settings → Database → Backups
              </p>
              <ol className="text-xs text-gray-600 space-y-1 ml-4 list-decimal">
                <li>Navigate to your Supabase project dashboard</li>
                <li>Go to Settings → Database → Backups</li>
                <li>Select the backup point you want to restore</li>
                <li>Click &quot;Restore&quot; and confirm</li>
                <li>Verify data after restoration completes</li>
              </ol>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-sm mb-1">Manual Exports</h3>
              <p className="text-sm text-gray-600 mb-2">
                Manual exports are data exports only. They can restore table data but not schema,
                functions, or triggers.
              </p>
              <ol className="text-xs text-gray-600 space-y-1 ml-4 list-decimal">
                <li>
                  Use the restore script:{" "}
                  <code className="bg-gray-100 px-1 rounded">scripts/restore-from-export.sh</code>
                </li>
                <li>Review SQL output before executing</li>
                <li>
                  Import tables in dependency order (sets → cards → acquisitions → lots → orders)
                </li>
                <li>Verify foreign key relationships are maintained</li>
              </ol>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Complete backup and recovery documentation is available in the project repository:
              <code className="bg-gray-100 px-2 py-1 rounded ml-2 text-xs">
                BACKUP_AND_RECOVERY.md
              </code>
            </p>
          </div>
        </div>
      </Card>

      {/* Best Practices */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Backup Best Practices</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm">3-2-1 Rule</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 3 copies of data</li>
                <li>✓ 2 different media types</li>
                <li>✓ 1 offsite copy</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">Testing Schedule</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Monthly: Test restore to staging</li>
                <li>• Quarterly: Full disaster recovery test</li>
                <li>• After schema changes: Verify backups</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Regularly test your backup restoration procedures to
              ensure they work when needed. A backup that can&apos;t be restored is not useful.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
