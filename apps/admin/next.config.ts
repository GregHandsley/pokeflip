import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Check if building for Cloudflare Pages
const isCloudflareBuild = process.env.CF_PAGES === "1" || process.env.CF_PAGES_BRANCH;

const nextConfig: NextConfig = {
  /* config options here */
  // Instrumentation is available by default in Next.js 16+, no config needed

  // Cloudflare Pages compatibility
  ...(isCloudflareBuild && {
    // Disable image optimization for Cloudflare (use Cloudflare Images or handle separately)
    images: {
      unoptimized: true,
    },
  }),
};

// Wrap with Sentry config
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for better error tracking
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // Disabled for now - can be re-enabled if ad-blockers become an issue
  // tunnelRoute: "/monitoring",

  // Note: hideSourceMaps, disableLogger, and automaticVercelMonitors are deprecated
  // but kept for compatibility. Sentry will handle these automatically.
});
