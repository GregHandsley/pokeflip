/**
 * Enhanced error alerting system
 * Provides critical error alerts and monitoring
 */

import * as Sentry from "@sentry/nextjs";
import { createApiLogger, LogContext } from "../logger";

// Error severity levels
export type ErrorSeverity = "critical" | "high" | "medium" | "low";

// Critical error patterns that should trigger alerts
const CRITICAL_ERROR_PATTERNS = [
  /database.*connection.*failed/i,
  /connection.*timeout/i,
  /out of memory/i,
  /database.*error/i,
  /authentication.*failed/i,
  /authorization.*failed/i,
  /unauthorized.*access/i,
  /data.*loss/i,
  /corruption/i,
  /transaction.*rollback/i,
  /deadlock/i,
  /lock.*timeout/i,
];

// High severity error patterns
const HIGH_ERROR_PATTERNS = [
  /payment.*failed/i,
  /order.*failed/i,
  /inventory.*mismatch/i,
  /stock.*out/i,
  /api.*rate.*limit/i,
  /external.*service.*error/i,
];

interface AlertContext extends LogContext {
  severity: ErrorSeverity;
  operation?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Check if an error matches critical patterns
 */
function classifyErrorSeverity(message: string, error?: Error): ErrorSeverity {
  const errorText = `${message} ${error?.message || ""} ${error?.stack || ""}`.toLowerCase();

  // Check for critical patterns
  if (CRITICAL_ERROR_PATTERNS.some((pattern) => pattern.test(errorText))) {
    return "critical";
  }

  // Check for high severity patterns
  if (HIGH_ERROR_PATTERNS.some((pattern) => pattern.test(errorText))) {
    return "high";
  }

  // Default severity based on error type
  if (error?.name === "TypeError" || error?.name === "ReferenceError") {
    return "high";
  }

  return "medium";
}

/**
 * Send alert for critical errors
 */
export function sendCriticalAlert(
  message: string,
  error: Error | unknown,
  context?: AlertContext
) {
  const logger = createApiLogger(context as unknown as Request, context?.userId, context?.userEmail);
  
  const err = error instanceof Error ? error : new Error(String(error));
  const severity = context?.severity || classifyErrorSeverity(message, err);

  // Enhanced logging with severity
  logger.error(message, err, context, {
    ...context?.metadata,
    severity,
    alert: true,
  });

  // Send to Sentry with enhanced context for critical/high errors
  if (severity === "critical" || severity === "high") {
    try {
      Sentry.withScope((scope) => {
        // Set severity level
        scope.setLevel(severity === "critical" ? "fatal" : "error");
        
        // Add tags for filtering
        scope.setTag("error_severity", severity);
        scope.setTag("alert", "true");
        if (context?.operation) {
          scope.setTag("operation", context.operation);
        }

        // Add user context if available
        if (context?.userId) {
          scope.setUser({
            id: context.userId,
            email: context.userEmail,
          });
        }

        // Add extra context
        scope.setContext("alert_context", {
          severity,
          operation: context?.operation,
          path: context?.path,
          method: context?.method,
          ...context?.metadata,
        });

        // Capture exception
        Sentry.captureException(err, {
          fingerprint: [severity, context?.operation || "unknown", err.message],
        });
      });

      // For critical errors, also send as message with higher visibility
      if (severity === "critical") {
        Sentry.captureMessage(`CRITICAL: ${message}`, {
          level: "fatal",
          tags: {
            error_severity: "critical",
            alert: "true",
            operation: context?.operation,
          },
        });
      }
    } catch (sentryError) {
      // Don't break app if Sentry fails
      console.error("Failed to send alert to Sentry:", sentryError);
    }
  }
}

/**
 * Enhanced error handler with alerting
 */
export function handleErrorWithAlert(
  message: string,
  error: Error | unknown,
  context?: AlertContext
) {
  sendCriticalAlert(message, error, context);
}

/**
 * Track key metrics and alert on anomalies
 */
export function trackMetric(
  metricName: string,
  value: number,
  threshold?: {
    min?: number;
    max?: number;
    criticalMin?: number;
    criticalMax?: number;
  },
  context?: LogContext
) {
  // Only track metrics if we have a valid context or create a minimal one
  try {
    const logger = context ? createApiLogger(context as unknown as Request, context?.userId) : createApiLogger(new Request("http://localhost"));

    // Check thresholds and alert if exceeded
    if (threshold) {
      const isCritical = 
        (threshold.criticalMin !== undefined && value < threshold.criticalMin) ||
        (threshold.criticalMax !== undefined && value > threshold.criticalMax);
      
      const isWarning =
        (threshold.min !== undefined && value < threshold.min) ||
        (threshold.max !== undefined && value > threshold.max);

      if (isCritical) {
        logger.error(
          `Critical metric threshold exceeded: ${metricName} = ${value}`,
          new Error(`Metric ${metricName} exceeded critical threshold`),
          context,
          {
            metric: metricName,
            value,
            threshold,
            severity: "critical",
          }
        );

        // Send to Sentry
        try {
          Sentry.captureMessage(`Critical metric: ${metricName} = ${value}`, {
            level: "error",
            tags: {
              metric_name: metricName,
              severity: "critical",
            },
            extra: {
              value,
              threshold,
              context,
            },
          });
        } catch (error) {
          // Ignore Sentry errors
        }
      } else if (isWarning) {
        logger.warn(`Metric threshold exceeded: ${metricName} = ${value}`, context, {
          metric: metricName,
          value,
          threshold,
          severity: "medium",
        });
      }
    }

    // Log metric (debug level)
    logger.debug(`Metric tracked: ${metricName} = ${value}`, context, {
      metric: metricName,
      value,
      threshold,
    });
  } catch (error) {
    // Silently fail metric tracking to avoid breaking the main flow
    console.error(`Failed to track metric ${metricName}:`, error);
  }
}

