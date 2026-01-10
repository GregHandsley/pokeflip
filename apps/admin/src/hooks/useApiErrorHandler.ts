"use client";

import { useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/lib/logger";

/**
 * Interface for validation errors from API
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Interface for API error response with validation errors
 */
export interface ApiErrorResponse {
  ok: false;
  error: string;
  code?: string;
  errors?: ValidationError[];
  details?: unknown;
}

/**
 * Hook for handling API errors with toast notifications
 */
export function useApiErrorHandler() {
  const { showError } = useToast();

  const handleError = useCallback(
    (
      error: unknown,
      context?: {
        operation?: string;
        metadata?: Record<string, unknown>;
        title?: string;
      }
    ) => {
      let message = context?.title || "An unexpected error occurred";
      let errorObj: Error | undefined;
      let validationErrors: ValidationError[] | undefined;

      // Handle API error responses with validation errors
      if (
        error &&
        typeof error === "object" &&
        "errors" in error &&
        Array.isArray((error as ApiErrorResponse).errors)
      ) {
        const apiError = error as ApiErrorResponse;
        validationErrors = apiError.errors;
        
        // Build message from validation errors
        if (validationErrors.length > 0) {
          if (validationErrors.length === 1) {
            message = validationErrors[0].message;
          } else {
            message = `Validation failed: ${validationErrors.length} error(s)`;
            // Log all validation errors
            validationErrors.forEach((err) => {
              logger.warn(`Validation error: ${err.field} - ${err.message}`, undefined, {
                field: err.field,
                code: err.code,
              });
            });
          }
        } else {
          message = apiError.error || message;
        }
        errorObj = new Error(message);
      } else if (error instanceof Error) {
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
        {
          ...context?.metadata,
          validationErrors: validationErrors?.map((e) => ({
            field: e.field,
            code: e.code,
          })),
        }
      );

      // Show user-friendly error message
      // If there are validation errors, show the first one or a summary
      if (validationErrors && validationErrors.length > 0) {
        if (validationErrors.length === 1) {
          showError(validationErrors[0].message);
        } else {
          showError(`Validation failed: ${validationErrors.map((e) => e.message).join(", ")}`);
        }
      } else {
        showError(message);
      }

      return { message, validationErrors };
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

