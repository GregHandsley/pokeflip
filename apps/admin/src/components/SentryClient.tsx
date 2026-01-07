"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryClient() {
  useEffect(() => {
    // Initialize Sentry on the client side
    if (typeof window !== "undefined") {
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      const enabled =
        process.env.NODE_ENV === "production" ||
        process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

      // Debug logging
      if (enabled) {
        console.log("[Sentry] Initializing Sentry client...");
        console.log("[Sentry] DSN:", dsn ? "✓ Set" : "✗ Missing");
        console.log("[Sentry] Environment:", process.env.NODE_ENV || "development");
      }

      if (!dsn) {
        console.warn("[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set!");
        return;
      }

      Sentry.init({
        dsn,
        tracesSampleRate: 1.0,
        environment: process.env.NODE_ENV || "development",
        enabled,
        // Enable debug mode in development to see what's happening
        debug: enabled && process.env.NODE_ENV === "development",
      });

      if (enabled) {
        console.log("[Sentry] Sentry initialized successfully");
      }
    }
  }, []);

  return null;
}

