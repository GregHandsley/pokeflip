/**
 * Helper utilities for handling API errors consistently
 */

import { NextResponse } from "next/server";
import { createApiLogger } from "./logger";
import { ValidationErrorResponse, formatValidationError } from "./validation";
import { handleErrorWithAlert } from "./monitoring/alerts";

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      details: process.env.NODE_ENV === "development" ? details : undefined,
    },
    { status: statusCode }
  );
}

/**
 * Handle API route errors with logging
 */
export function handleApiError(
  req: Request,
  error: unknown,
  context?: {
    userId?: string;
    userEmail?: string;
    operation?: string;
    metadata?: Record<string, unknown>;
  }
): NextResponse {
  const logger = createApiLogger(req, context?.userId, context?.userEmail);

  // Handle validation errors specially
  if (error instanceof ValidationErrorResponse) {
    const validationResponse = formatValidationError(error);
    logger.warn("Validation failed", undefined, {
      errors: error.errors,
      operation: context?.operation,
      ...context?.metadata,
    });
    return NextResponse.json(
      {
        ok: false,
        ...validationResponse,
      },
      { status: error.statusCode }
    );
  }

  // Extract error information
  let message = "An unexpected error occurred";
  let statusCode = 500;
  let code: string | undefined;
  let details: unknown;

  if (error instanceof Error) {
    message = error.message;
    details = {
      name: error.name,
      stack: error.stack,
    };
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object" && "message" in error) {
    message = String(error.message);
    if ("statusCode" in error) {
      statusCode = Number(error.statusCode) || 500;
    }
    if ("code" in error) {
      code = String(error.code);
    }
    details = error;
  }

  // Log the error
  const logMessage = context?.operation ? `${context.operation} failed` : "API request failed";

  // Use enhanced error alerting for critical errors
  if (statusCode >= 500) {
    handleErrorWithAlert(logMessage, error instanceof Error ? error : new Error(message), {
      severity: "high",
      userId: context?.userId,
      userEmail: context?.userEmail,
      operation: context?.operation,
      metadata: context?.metadata,
    });
  } else {
    logger.error(
      logMessage,
      error instanceof Error ? error : new Error(message),
      undefined,
      context?.metadata
    );
  }

  // Return standardized error response
  return createErrorResponse(message, statusCode, code, details);
}

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (req: Request, ...args: T) => Promise<NextResponse>,
  context?: {
    operation?: string;
  }
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      return handleApiError(req, error, context);
    }
  };
}
