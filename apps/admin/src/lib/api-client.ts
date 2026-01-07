/**
 * Client-side API helper with automatic error handling and toast notifications
 */

import { useToast } from "@/contexts/ToastContext";
import { logger } from "./logger";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

/**
 * Fetch with automatic error handling and toast notifications
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  showToast: boolean = true
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || `Request failed with status ${response.status}`;
      
      // Log error
      logger.error("API request failed", new Error(errorMessage), {
        path: url,
        method: options?.method || "GET",
        status: response.status,
        statusText: response.statusText,
      });

      // Show toast if enabled
      if (showToast && typeof window !== "undefined") {
        // We'll need to get toast from context, but this is a utility function
        // For now, we'll let the caller handle toasts
        // Or we could make this accept a toast function
      }

      return {
        ok: false,
        error: errorMessage,
        code: data.code,
        details: data.details,
      };
    }

    return {
      ok: true,
      data: data.data || data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";
    
    logger.error("API request failed", error instanceof Error ? error : new Error(errorMessage), {
      path: url,
      method: options?.method || "GET",
    });

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

/**
 * Hook version that uses toast context
 * Note: This must be used within a component that has ToastProvider
 */
export function useApiClient() {
  // This will be called from components, so we can use hooks
  // For now, we'll export a simpler version that accepts toast functions
  return {
    fetch: apiFetch,
  };
}

  const fetch = async <T = unknown>(
    url: string,
    options?: RequestInit,
    showSuccessToast: boolean = false,
    successMessage?: string
  ): Promise<ApiResponse<T>> => {
    const response = await apiFetch<T>(url, options, false);

    if (!response.ok) {
      showError(response.error || "An error occurred");
    } else if (showSuccessToast && successMessage) {
      showSuccess(successMessage);
    }

    return response;
  };

  return { fetch };
}

