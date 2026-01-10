/**
 * API response time tracking middleware
 * Tracks response times for all API routes and logs slow requests
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiLogger } from "../logger";

// Configuration
const SLOW_REQUEST_THRESHOLD_MS = 1000; // Log requests slower than 1 second
const VERY_SLOW_REQUEST_THRESHOLD_MS = 3000; // Alert on requests slower than 3 seconds

interface ResponseTimeStats {
  path: string;
  method: string;
  responseTimeMs: number;
  statusCode: number;
  timestamp: string;
}

// Store start times for requests (in-memory, will be cleared after request)
const requestStartTimes = new Map<string, number>();

/**
 * Track response time for API routes in middleware
 * Adds a start time header and sets up tracking
 */
export function trackResponseTime(req: NextRequest, res: NextResponse) {
  const startTime = Date.now();
  const url = new URL(req.url);
  
  // Generate a unique request ID based on URL and timestamp
  const requestId = `${req.method}:${url.pathname}:${startTime}`;
  requestStartTimes.set(requestId, startTime);

  // Add headers
  res.headers.set("X-Request-Start-Time", startTime.toString());
  res.headers.set("X-Request-ID", requestId);

  // Clean up old entries periodically (keep only last 1000)
  if (requestStartTimes.size > 1000) {
    const entries = Array.from(requestStartTimes.entries());
    const toKeep = entries.slice(-500); // Keep last 500
    requestStartTimes.clear();
    toKeep.forEach(([key, value]) => requestStartTimes.set(key, value));
  }

  return res;
}

/**
 * Log response time for a completed request
 * Call this from API route handlers after processing
 */
export function logResponseTime(req: Request, responseTimeMs: number, statusCode: number) {
  const url = new URL(req.url);
  
  const stats: ResponseTimeStats = {
    path: url.pathname,
    method: req.method,
    responseTimeMs,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  const logger = createApiLogger(req);

  // Log slow requests
  if (responseTimeMs >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
    logger.error(
      "Very slow API request detected",
      new Error(`Request took ${responseTimeMs}ms`),
      undefined,
      {
        operation: "response_time_tracking",
        ...stats,
        severity: "high",
      }
    );
  } else if (responseTimeMs >= SLOW_REQUEST_THRESHOLD_MS) {
    logger.warn("Slow API request detected", undefined, {
      operation: "response_time_tracking",
      ...stats,
      severity: "medium",
    });
  } else {
    // Debug log for all requests (only in development)
    logger.debug("API request completed", undefined, {
      operation: "response_time_tracking",
      ...stats,
    });
  }
}

/**
 * Get request start time from middleware
 */
export function getRequestStartTime(req: Request): number | null {
  const startTimeHeader = req.headers.get("X-Request-Start-Time");
  if (startTimeHeader) {
    return parseInt(startTimeHeader, 10);
  }
  return null;
}

