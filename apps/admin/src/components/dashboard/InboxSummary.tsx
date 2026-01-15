"use client";

import Card from "@/components/ui/Card";

type InboxSummary = {
  readyToList: number;
  needsPhotos: number;
  highValueReady: number;
};

interface Props {
  data: InboxSummary | null;
  loading: boolean;
}

export default function InboxSummary({ data, loading }: Props) {
  if (loading) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Inbox Summary</h3>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const hasActions = data.readyToList > 0 || data.needsPhotos > 0 || data.highValueReady > 0;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Inbox Summary</h3>
          <a
            href="/admin/inbox"
            className="text-xs text-gray-600 hover:text-gray-900 font-medium underline"
          >
            View All
          </a>
        </div>

        {!hasActions ? (
          <div className="text-sm text-gray-500 py-2">
            All items are up to date. No action needed.
          </div>
        ) : (
          <div className="space-y-3">
            {data.highValueReady > 0 && (
              <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium text-green-900">
                    High-value ready to list
                  </span>
                </div>
                <span className="text-sm font-bold text-green-700">{data.highValueReady}</span>
              </div>
            )}

            {data.readyToList > 0 && (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-900">Ready to list</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{data.readyToList}</span>
              </div>
            )}

            {data.needsPhotos > 0 && (
              <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  <span className="text-sm font-medium text-orange-900">Need photos</span>
                </div>
                <span className="text-sm font-bold text-orange-700">{data.needsPhotos}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
