"use client";

import { useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/lib/logger";

/**
 * Hook for handling API errors with toast notifications
 */
export function useApiErrorHandler() {
  const { showError } = useToast();

  const handleError = useCallback(
    (error: unknown, context?: { operation?: string; metadata?: Record<string, unknown> }) => {
      let message = "An unexpected error occurred";
      let errorObj: Error | undefined;

      if (error instanceof Error) {
        message = error.message;
        errorObj = error;
      } else if (typeof error === "string") {
        message = error;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
      }

      // Log the error
      logger.error(
        context?.operation ? `${context.operation} failed` : "API request failed",
        errorObj || new Error(message),
        {
          path: window.location.pathname,
        },
        context?.metadata
      );

      // Show user-friendly error message
      showError(message);

      return message;
    },
    [showError]
  );

  /**
   * Wrap an async function to handle errors automatically
   */
  const withErrorHandling = useCallback(
    <T extends unknown[], R>(
      fn: (...args: T) => Promise<R>,
      context?: { operation?: string }
    ) => {
      return async (...args: T): Promise<R | null> => {
        try {
          return await fn(...args);
        } catch (error) {
          handleError(error, context);
          return null;
        }
      };
    },
    [handleError]
  );

  return {
    handleError,
    withErrorHandling,
  };
}

