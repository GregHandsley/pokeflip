/**
 * Structured logging utility
 * 
 * Integrated with Sentry for production error tracking
 */

import * as Sentry from "@sentry/nextjs";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  userEmail?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Log an entry with structured data
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // In development, log to console with formatting
    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      console.log(
        `%c[${entry.timestamp}] ${level.toUpperCase()}: ${message}`,
        style,
        { context, error, metadata }
      );
    }

    // Send to Sentry in production (or if explicitly enabled)
    const sentryEnabled = this.isProduction || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
    if (sentryEnabled) {
      try {
        if (level === "error" && error) {
          // Send exceptions to Sentry
          Sentry.captureException(error, {
            level: "error",
            tags: {
              operation: metadata?.operation as string | undefined,
            },
            extra: {
              message,
              context,
              metadata,
            },
          });
        } else if (level === "warn" || level === "error") {
          // Send warnings and errors as messages
          Sentry.captureMessage(message, {
            level: level === "warn" ? "warning" : "error",
            tags: {
              operation: metadata?.operation as string | undefined,
            },
            extra: {
              context,
              metadata,
              error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              } : undefined,
            },
          });
        }
      } catch (sentryError) {
        // Don't break app if Sentry fails
        console.error("Failed to send log to Sentry:", sentryError);
      }
    }

    // Always log errors to console.error for visibility
    if (level === "error") {
      console.error(`[${entry.timestamp}] ERROR: ${message}`, {
        context,
        error,
        metadata,
      });
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      debug: "color: #6b7280; font-weight: normal",
      info: "color: #3b82f6; font-weight: normal",
      warn: "color: #f59e0b; font-weight: bold",
      error: "color: #ef4444; font-weight: bold",
    };
    return styles[level];
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    if (this.isDevelopment) {
      this.log("debug", message, context, undefined, metadata);
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("info", message, context, undefined, metadata);
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>) {
    this.log("warn", message, context, undefined, metadata);
  }

  /**
   * Log errors with full context
   */
  error(message: string, error?: Error | unknown, context?: LogContext, metadata?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log("error", message, context, err, metadata);
  }

  /**
   * Create a logger with default context (useful for API routes)
   */
  withContext(defaultContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext, metadata?: Record<string, unknown>) =>
        this.debug(message, { ...defaultContext, ...context }, metadata),
      info: (message: string, context?: LogContext, metadata?: Record<string, unknown>) =>
        this.info(message, { ...defaultContext, ...context }, metadata),
      warn: (message: string, context?: LogContext, metadata?: Record<string, unknown>) =>
        this.warn(message, { ...defaultContext, ...context }, metadata),
      error: (message: string, error?: Error | unknown, context?: LogContext, metadata?: Record<string, unknown>) =>
        this.error(message, error, { ...defaultContext, ...context }, metadata),
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export helper for API routes
export function createApiLogger(req: Request, userId?: string, userEmail?: string) {
  const url = new URL(req.url);
  const context: LogContext = {
    userId,
    userEmail,
    path: url.pathname,
    method: req.method,
    userAgent: req.headers.get("user-agent") || undefined,
    // Note: IP address would need to be extracted from headers in production
  };

  return logger.withContext(context);
}

