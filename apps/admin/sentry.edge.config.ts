// Skip Sentry on Cloudflare Pages to stay under 25 MiB worker bundle limit.
// CF_PAGES=1 is set at build time so the bundler can tree-shake @sentry/nextjs out.
if (process.env.CF_PAGES !== "1") {
  const Sentry = await import("@sentry/nextjs");
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
}
export {};
