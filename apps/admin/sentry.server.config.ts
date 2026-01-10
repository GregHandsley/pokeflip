import * as Sentry from "@sentry/nextjs";

// Note: Sentry configs may load before instrumentation.ts runs
// Use direct env access with fallbacks for early initialization
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || null;
const enabled =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
const environment = (process.env.NODE_ENV || "development") as
  | "development"
  | "staging"
  | "production";

// Debug logging for server-side Sentry
if (enabled) {
  console.log("[Sentry Server] Initializing server-side Sentry...");
  console.log("[Sentry Server] DSN:", dsn ? "✓ Set" : "✗ Missing");
  console.log("[Sentry Server] Environment:", environment);
}

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: 1.0,
  environment,
  enabled,
  // Enable debug mode in development
  debug: enabled && environment === "development",
});

if (enabled) {
  console.log("[Sentry Server] Server-side Sentry initialized successfully");
}

