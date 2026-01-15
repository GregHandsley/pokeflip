import type { ImportProgress as ImportProgressType } from "../hooks/useBulkImport";

type ImportProgressProps = {
  progress: ImportProgressType | null;
};

export function ImportProgress({ progress }: ImportProgressProps) {
  if (!progress) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-900">{progress.message}</span>
        {progress.progress && (
          <span className="text-sm text-blue-700">
            {progress.progress.current} / {progress.progress.total}
          </span>
        )}
      </div>
      {progress.progress && (
        <div className="w-full bg-blue-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{
              width: `${(progress.progress.current / progress.progress.total) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
