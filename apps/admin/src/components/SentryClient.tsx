"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryClient() {
  useEffect(() => {
    // Initialize Sentry on the client side
    if (typeof window !== "undefined") {
      // Use direct env var access (client-safe, avoids validation issues)
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || null;
      const enabled =
        process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
      const environment = (process.env.NODE_ENV || "development") as
        | "development"
        | "staging"
        | "production";

      const config = { dsn, enabled, environment };

      // Debug logging
      if (config.enabled) {
        console.log("[Sentry] Initializing Sentry client...");
        console.log("[Sentry] DSN:", config.dsn ? "✓ Set" : "✗ Missing");
        console.log("[Sentry] Environment:", config.environment);
      }

      if (!config.dsn) {
        console.warn("[Sentry] Sentry DSN is not set!");
        return;
      }

      Sentry.init({
        dsn: config.dsn,
        tracesSampleRate: 1.0,
        environment: config.environment,
        enabled: config.enabled,
        // Enable debug mode in development to see what's happening
        debug: config.enabled && config.environment === "development",
      });

      if (config.enabled) {
        console.log("[Sentry] Sentry initialized successfully");
      }
    }
  }, []);

  return null;
}
