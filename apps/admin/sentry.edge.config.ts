import * as Sentry from "@sentry/nextjs";

// Note: Sentry configs load early, use direct env access for reliability
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || null;
const enabled =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
const environment = (process.env.NODE_ENV || "development") as
  | "development"
  | "staging"
  | "production";

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: 1.0,
  environment,
  enabled,
});
