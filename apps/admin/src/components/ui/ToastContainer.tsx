"use client";

import { useToast } from "@/contexts/ToastContext";

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg border px-4 py-3 text-sm font-medium shadow-lg
            animate-in slide-in-from-top-5 fade-in
            ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border-green-200"
                : toast.type === "error"
                  ? "bg-red-50 text-red-800 border-red-200"
                  : toast.type === "warning"
                    ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
            }
          `}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="flex-1">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className={`
                shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity
                ${toast.type === "success" ? "text-green-600" : toast.type === "error" ? "text-red-600" : toast.type === "warning" ? "text-yellow-600" : "text-blue-600"}
              `}
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
