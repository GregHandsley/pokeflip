import { useState } from "react";

export type ImportProgress = {
  stage: string;
  message: string;
  progress?: { current: number; total: number };
};

export function useBulkImport(onSuccess: () => Promise<void>) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [enabledLocales, setEnabledLocales] = useState<Set<string>>(new Set());

  const toggleLocale = (localeCode: string) => {
    setEnabledLocales((prev) => {
      const next = new Set(prev);
      if (next.has(localeCode)) {
        next.delete(localeCode);
      } else {
        next.add(localeCode);
      }
      return next;
    });
  };

  const handleBulkImport = async () => {
    if (enabledLocales.size === 0) {
      setImportStatus("Error: Please select at least one language to import");
      return;
    }

    setImporting(true);
    setImportProgress({ stage: "starting", message: "Initializing..." });
    setImportStatus(null);

    try {
      const res = await fetch("/api/catalog/set-translations/bulk-import-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledLocales: Array.from(enabledLocales),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.stage) {
                setImportProgress({
                  stage: data.stage,
                  message: data.message || "",
                  progress: data.progress,
                });
              }

              if (data.stage === "complete" && data.result) {
                setImportStatus(
                  `Import complete! ${data.result.imported} translations imported ` +
                    `from ${data.result.localesProcessed?.length || 0} language(s)`
                );
                setImportProgress(null);
                await onSuccess();
                setTimeout(() => setImportStatus(null), 15000);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (e: unknown) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : "Failed to import translations"}`);
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setEnabledLocales(new Set());
    setImportStatus(null);
    setImportProgress(null);
  };

  return {
    importing,
    importStatus,
    importProgress,
    enabledLocales,
    toggleLocale,
    handleBulkImport,
    reset,
  };
}
