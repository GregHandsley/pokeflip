import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || "development",
  // Only send errors in production, or if explicitly enabled
  enabled: process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
});

