/**
 * Environment Configuration
 * Centralized configuration with validation and environment-specific defaults
 */

export type Environment = "development" | "staging" | "production";

export interface EnvConfig {
  // Environment
  env: Environment;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;

  // Supabase (Required)
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string; // Server-only
  };

  // Sentry (Optional)
  sentry: {
    dsn: string | null;
    enabled: boolean;
    org: string | null;
    project: string | null;
    environment: Environment;
  };

  // Application
  app: {
    siteUrl: string;
    priceFloorGbp: number;
  };

  // Build/Runtime
  runtime: {
    isCI: boolean;
    nextRuntime: string | null;
  };
}

/**
 * Checks if we're running on the server (vs client/browser)
 */
function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Validates that required environment variables are present
 * Context-aware: only validates server-only variables when on the server
 */
function validateRequiredEnvVars(validateServerOnly: boolean = true): void {
  // Public variables (available on both client and server)
  const publicRequired: Array<{ key: string; description: string }> = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      description: "Supabase project URL",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      description: "Supabase anonymous (public) key",
    },
  ];

  // Server-only variables (only validate on server)
  const serverOnlyRequired: Array<{ key: string; description: string }> = [
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      description: "Supabase service role key (server-only)",
    },
  ];

  const missing: string[] = [];

  // Always validate public variables
  for (const { key, description } of publicRequired) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`);
    }
  }

  // Only validate server-only variables when requested (and on server)
  if (validateServerOnly && isServer()) {
    for (const { key, description } of serverOnlyRequired) {
      if (!process.env[key]) {
        missing.push(`${key} (${description})`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join("\n")}\n\n` +
        "Please check your .env file or environment configuration."
    );
  }
}

/**
 * Gets the current environment
 */
function getEnvironment(): Environment {
  const env = process.env.NODE_ENV || "development";

  // Support custom environment variable
  if (process.env.APP_ENV) {
    const appEnv = process.env.APP_ENV.toLowerCase();
    if (appEnv === "staging" || appEnv === "production" || appEnv === "development") {
      return appEnv;
    }
  }

  // Map NODE_ENV to our environment types
  if (env === "production") {
    return "production";
  }

  if (env === "test") {
    return "development"; // Tests run in development mode
  }

  return "development";
}

/**
 * Creates and validates the environment configuration
 * @param validateServerOnly - Whether to validate server-only variables (default: true)
 * @param skipValidation - If true, skip all validation (for client-side safety)
 */
function createConfig(validateServerOnly: boolean = true, skipValidation: boolean = false): EnvConfig {
  // Skip validation if requested (client-side safety)
  if (!skipValidation) {
    validateRequiredEnvVars(validateServerOnly);
  }

  const environment = getEnvironment();
  const isDevelopment = environment === "development";
  const isStaging = environment === "staging";
  const isProduction = environment === "production";

  // Get Sentry DSN (prefer NEXT_PUBLIC_SENTRY_DSN, fallback to SENTRY_DSN)
  const sentryDsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || null;

  // Sentry is enabled in production, or if explicitly enabled
  const sentryEnabled =
    isProduction || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

  // Site URL with fallback
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (isDevelopment ? "http://127.0.0.1:3000" : "https://your-domain.com");

  // Price floor with default
  const priceFloorGbp = Number(process.env.PRICE_FLOOR_GBP || "0.99");

  // Get Supabase values (with fallbacks for client-side where vars may not be available)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    env: environment,
    isDevelopment,
    isStaging,
    isProduction,

    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
    },

    sentry: {
      dsn: sentryDsn,
      enabled: sentryEnabled,
      org: process.env.SENTRY_ORG || null,
      project: process.env.SENTRY_PROJECT || null,
      environment,
    },

    app: {
      siteUrl,
      priceFloorGbp,
    },

    runtime: {
      isCI: process.env.CI === "true",
      nextRuntime: process.env.NEXT_RUNTIME || null,
    },
  };
}

// Create singleton config instance
let config: EnvConfig | null = null;

/**
 * Gets the environment configuration
 * Validates required variables on first access
 * Context-aware: only validates server-only variables when on the server
 * @param skipValidation - If true, skip all validation (useful for client-side where vars may not be available)
 */
export function getEnvConfig(skipValidation: boolean = false): EnvConfig {
  if (!config) {
    // On client, always skip validation (env vars may not be available at runtime)
    // On server, validate but only check server-only vars if we're actually on server
    const isClient = !isServer();
    const shouldSkipValidation = skipValidation || isClient;
    const validateServerOnly = !shouldSkipValidation && isServer();
    
    config = createConfig(validateServerOnly, shouldSkipValidation);
  }
  return config;
}

/**
 * Resets the config (useful for testing)
 */
export function resetEnvConfig(): void {
  config = null;
}

/**
 * Gets Supabase config (client-safe, skips validation)
 * Use this in client components or when you only need public Supabase vars
 * Note: This function does not validate - it assumes public vars are available
 */
export const supabase = (): EnvConfig["supabase"] => {
  // Skip validation for client-side access (vars may not be available at runtime)
  const config = getEnvConfig(!isServer());
  return {
    url: config.supabase.url,
    anonKey: config.supabase.anonKey,
    serviceRoleKey: config.supabase.serviceRoleKey, // May be empty on client
  };
};

/**
 * Gets Supabase config with server-only validation
 * Use this in server-side code that needs the service role key
 * @throws Error if service role key is missing (server-side only)
 */
export const getSupabaseConfigForServer = (): EnvConfig["supabase"] => {
  // On server, validate all required vars including service role key
  if (typeof window === "undefined") {
    const config = getEnvConfig(false); // Validate on server
    if (!config.supabase.serviceRoleKey) {
      throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY\n\n" +
          "This variable is required for server-side operations and should be set in your .env.local file."
      );
    }
    return config.supabase;
  }
  // On client, return what we have (service role key won't be available)
  // This shouldn't be called on client, but handle gracefully
  return supabase();
};

// Export other config sections for convenience
// These skip validation on client-side for safety
export const env = (): EnvConfig["env"] => getEnvConfig(!isServer()).env;
export const sentry = (): EnvConfig["sentry"] => getEnvConfig(!isServer()).sentry;
export const app = (): EnvConfig["app"] => getEnvConfig(!isServer()).app;
export const runtime = (): EnvConfig["runtime"] => getEnvConfig(!isServer()).runtime;

