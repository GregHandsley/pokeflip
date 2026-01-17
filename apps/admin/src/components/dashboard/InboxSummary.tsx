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
      <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-blue-50/30">
        <div className="p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-gray-900">Inbox Summary</h3>
          </div>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const hasActions = data.readyToList > 0 || data.needsPhotos > 0 || data.highValueReady > 0;
  const totalItems = data.readyToList + data.needsPhotos + data.highValueReady;

  return (
    <Card className="border border-gray-200 shadow-sm h-full flex flex-col bg-gradient-to-br from-white to-blue-50/30 hover:shadow-md transition-shadow">
      <div className="p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Inbox Summary</h3>
              {hasActions && (
                <p className="text-xs text-gray-500">
                  {totalItems} item{totalItems !== 1 ? "s" : ""} need attention
                </p>
              )}
            </div>
          </div>
          <a
            href="/admin/inbox"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline transition-colors"
          >
            View All →
          </a>
        </div>

        {!hasActions ? (
          <div className="flex items-center justify-center py-2">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-xs font-medium text-gray-700">All items are up to date</p>
              <p className="text-xs text-gray-500 mt-0.5">No action needed</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {data.highValueReady > 0 && (
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-green-900 block">
                      High-value ready
                    </span>
                    <span className="text-xs text-green-700">£20+ items</span>
                  </div>
                </div>
                <span className="text-base font-bold text-green-700 bg-white px-2 py-1 rounded">
                  {data.highValueReady}
                </span>
              </div>
            )}

            {data.readyToList > 0 && (
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-blue-900 block">Ready to list</span>
                    <span className="text-xs text-blue-700">All requirements met</span>
                  </div>
                </div>
                <span className="text-base font-bold text-blue-700 bg-white px-2 py-1 rounded">
                  {data.readyToList}
                </span>
              </div>
            )}

            {data.needsPhotos > 0 && (
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-orange-900 block">Need photos</span>
                    <span className="text-xs text-orange-700">Missing images</span>
                  </div>
                </div>
                <span className="text-base font-bold text-orange-700 bg-white px-2 py-1 rounded">
                  {data.needsPhotos}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
