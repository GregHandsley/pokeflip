import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

// Debug logging for server-side Sentry
if (enabled) {
  console.log("[Sentry Server] Initializing server-side Sentry...");
  console.log("[Sentry Server] DSN:", dsn ? "✓ Set" : "✗ Missing");
  console.log("[Sentry Server] Environment:", process.env.NODE_ENV || "development");
}

Sentry.init({
  dsn,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || "development",
  enabled,
  // Enable debug mode in development
  debug: enabled && process.env.NODE_ENV === "development",
});

if (enabled) {
  console.log("[Sentry Server] Server-side Sentry initialized successfully");
}

