import { withSentryConfig } from "@sentry/nextjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

// Directory containing this config (apps/admin)
const configDir =
  typeof import.meta?.url === "string"
    ? path.dirname(fileURLToPath(import.meta.url))
    : path.resolve(__dirname);

// Turbopack needs the monorepo root to resolve next/package.json in pnpm workspaces
const monorepoRoot = path.resolve(configDir, "..", "..");

// Skip Sentry when building for Cloudflare Pages to stay under 25 MiB bundle limit.
// Check both env (set in Cloudflare dashboard or build script) and .building-for-cf file
// (created by build:cloudflare so detection works even when env doesn't propagate to next build).
const isCloudflareBuild =
  process.env.CF_PAGES === "1" || fs.existsSync(path.join(configDir, ".building-for-cf"));

const nextConfig = {
  /* config options here */
  // Instrumentation is available by default in Next.js 16+, no config needed

  // Cloudflare Pages compatibility
  images: {
    unoptimized: true,
  },

  // Next.js requires these to be the same value. Use monorepo root so Turbopack can resolve next/package.json.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },

  // Inline CF_PAGES at build time so bundler can tree-shake Sentry out of edge bundle
  ...(isCloudflareBuild && {
    webpack: (config, { webpack }) => {
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.CF_PAGES": JSON.stringify("1"),
        })
      );
      return config;
    },
  }),
} as NextConfig;
export default isCloudflareBuild
  ? nextConfig
  : withSentryConfig(nextConfig, {
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
