/**
 * Response time tracking wrapper for API route handlers
 * Wraps API handlers to automatically track response times
 */

import { NextResponse } from "next/server";
import { Request } from "next/server";
import { logResponseTime, getRequestStartTime } from "./response-time";

/**
 * Wrap an API route handler to track response times
 */
export function withResponseTimeTracking<T extends unknown[]>(
  handler: (req: Request, ...args: T) => Promise<NextResponse>,
  context?: {
    operation?: string;
  }
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const startTime = getRequestStartTime(req) || Date.now();
    
    try {
      const response = await handler(req, ...args);
      const responseTime = Date.now() - startTime;
      
      // Add response time header
      response.headers.set("X-Response-Time", `${responseTime}ms`);
      
      // Log response time
      logResponseTime(req, responseTime, response.status);
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log even if error occurred
      logResponseTime(req, responseTime, 500);
      
      throw error;
    }
  };
}

