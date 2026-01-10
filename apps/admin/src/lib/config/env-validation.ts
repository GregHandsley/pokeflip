/**
 * Environment Validation
 * Validates environment variables on application startup
 * This should be called early in the application lifecycle (server-side only)
 */

import { getEnvConfig } from "./env";

let validated = false;

/**
 * Validates environment configuration on startup
 * Call this function early in your application (e.g., in instrumentation.ts or app initialization)
 * NOTE: This should only be called server-side (it validates server-only variables)
 */
export function validateEnvironment(): void {
  // Only validate on server (instrumentation.ts runs server-side)
  if (typeof window !== "undefined") {
    return; // Skip validation on client
  }

  if (validated) {
    return; // Only validate once
  }

  try {
    // Force validation of ALL variables including server-only (we're on the server)
    // Pass false to skipValidation to ensure full validation happens
    // We need to access the config in a way that forces validation
    const config = getEnvConfig(false); // false = don't skip validation
    
    // Verify required server-only variables are present
    if (!config.supabase.serviceRoleKey) {
      throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY (Supabase service role key (server-only))\n\n" +
          "Please check your .env.local file or environment configuration."
      );
    }

    // Additional validation beyond required variables
    const warnings: string[] = [];

    // Warn about missing Sentry in production
    if (config.isProduction && !config.sentry.dsn) {
      warnings.push(
        "⚠️  Sentry DSN not configured - error tracking will be disabled in production"
      );
    }

    // Warn about default site URL in production
    if (config.isProduction && config.app.siteUrl.includes("your-domain.com")) {
      warnings.push(
        "⚠️  NEXT_PUBLIC_SITE_URL not set - using default (this may cause issues)"
      );
    }

    // Warn about development defaults in staging
    if (config.isStaging && config.app.siteUrl.includes("127.0.0.1")) {
      warnings.push(
        "⚠️  NEXT_PUBLIC_SITE_URL appears to be a development URL - this may cause issues in staging"
      );
    }

    // Log warnings (but don't fail)
    if (warnings.length > 0) {
      console.warn("\n📋 Environment Configuration Warnings:\n");
      warnings.forEach((warning) => console.warn(`  ${warning}`));
      console.warn("");
    }

    // Log success message in development
    if (config.isDevelopment) {
      console.log("✅ Environment configuration validated");
      console.log(`   Environment: ${config.env}`);
      console.log(`   Supabase URL: ${config.supabase.url}`);
      console.log(`   Site URL: ${config.app.siteUrl}`);
      console.log(`   Sentry: ${config.sentry.enabled ? "✓ Enabled" : "✗ Disabled"}`);
    }

    validated = true;
  } catch (error) {
    console.error("\n❌ Environment Configuration Error:\n");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nPlease check your .env.local file or environment variables.\n");
    throw error; // Re-throw to prevent app from starting with invalid config
  }
}

/**
 * Gets validation status
 */
export function isEnvironmentValidated(): boolean {
  return validated;
}

