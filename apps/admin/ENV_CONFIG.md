# Environment Configuration Guide

This document describes all environment variables used by the application and how to configure them for different environments.

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in required variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Optional: Configure Sentry and other services**

4. **Start the application** - validation happens automatically on startup

## Environment Variables

### Required Variables

These variables **must** be set for the application to start:

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Description**: Supabase project URL
- **Type**: Public (exposed to client)
- **Example**: `https://abcdefghijklmnop.supabase.co`
- **Where to get**: Supabase Dashboard → Project Settings → API → Project URL
- **Required**: ✅ Yes

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Description**: Supabase anonymous (public) key - safe for client-side use
- **Type**: Public (exposed to client)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get**: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`
- **Required**: ✅ Yes

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Description**: Supabase service role key - **NEVER expose to client!**
- **Type**: Private (server-only)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get**: Supabase Dashboard → Project Settings → API → Project API keys → `service_role` `secret`
- **Security**: 🔒 This key bypasses Row Level Security - handle with extreme care
- **Required**: ✅ Yes

### Optional Variables

#### Application Environment

##### `APP_ENV`
- **Description**: Application environment (`development`, `staging`, `production`)
- **Type**: Private (server-only)
- **Default**: Derived from `NODE_ENV`
- **Example**: `APP_ENV=staging`
- **Required**: ❌ No

##### `NEXT_PUBLIC_SITE_URL`
- **Description**: Base URL of the application (used for CORS, absolute URLs, etc.)
- **Type**: Public (exposed to client)
- **Default**: `http://127.0.0.1:3000` (development), `https://your-domain.com` (production)
- **Example**: `https://admin.pokeflip.com`
- **Required**: ❌ No (but recommended for production)

##### `PRICE_FLOOR_GBP`
- **Description**: Minimum price floor for card listings (in GBP)
- **Type**: Private (server-only)
- **Default**: `0.99`
- **Example**: `PRICE_FLOOR_GBP=1.50`
- **Required**: ❌ No

#### Sentry Error Tracking

##### `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`
- **Description**: Sentry Data Source Name for error tracking
- **Type**: `NEXT_PUBLIC_SENTRY_DSN` is public, `SENTRY_DSN` is private (server-only)
- **Default**: None (Sentry disabled)
- **Example**: `https://abc123@o123456.ingest.sentry.io/123456`
- **Where to get**: Sentry Dashboard → Settings → Projects → Client Keys (DSN)
- **Required**: ❌ No (but recommended for production)

##### `NEXT_PUBLIC_SENTRY_ENABLED`
- **Description**: Enable Sentry in development/staging (default: only enabled in production)
- **Type**: Public (exposed to client)
- **Default**: `false` (enabled automatically in production)
- **Example**: `NEXT_PUBLIC_SENTRY_ENABLED=true`
- **Required**: ❌ No

##### `SENTRY_ORG`
- **Description**: Sentry organization slug (required for source map uploads)
- **Type**: Private (server-only)
- **Default**: None
- **Example**: `my-org`
- **Where to get**: Sentry Dashboard URL: `https://sentry.io/organizations/[ORG-SLUG]/`
- **Required**: ❌ No (only needed for source map uploads)

##### `SENTRY_PROJECT`
- **Description**: Sentry project slug (required for source map uploads)
- **Type**: Private (server-only)
- **Default**: None
- **Example**: `pokeflip-admin`
- **Where to get**: Sentry Dashboard → Settings → Projects → Project Slug
- **Required**: ❌ No (only needed for source map uploads)

### Automatic Variables

These are set automatically by the framework or runtime - you typically don't need to set them:

- `NODE_ENV`: Set by Next.js (`development`, `production`, `test`)
- `NEXT_RUNTIME`: Set by Next.js (`nodejs`, `edge`)
- `CI`: Set by CI/CD systems (`true` when running in CI)

## Environment-Specific Configuration

### Development (Local)

```env
APP_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SENTRY_ENABLED=false
```

**Notes:**
- Sentry is disabled by default (set `NEXT_PUBLIC_SENTRY_ENABLED=true` to enable)
- Uses local Supabase instance or development Supabase project
- `NEXT_PUBLIC_SITE_URL` defaults to localhost

### Staging

```env
APP_ENV=staging
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=staging-service-role-key
NEXT_PUBLIC_SITE_URL=https://staging.pokeflip.com
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_ENABLED=true
SENTRY_ORG=your-org
SENTRY_PROJECT=pokeflip-admin
```

**Notes:**
- Uses staging Supabase project
- Sentry enabled for monitoring
- Set proper staging URL

### Production

```env
APP_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=prod-service-role-key
NEXT_PUBLIC_SITE_URL=https://admin.pokeflip.com
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=pokeflip-admin
PRICE_FLOOR_GBP=0.99
```

**Notes:**
- Sentry automatically enabled (no need to set `NEXT_PUBLIC_SENTRY_ENABLED`)
- Use production Supabase project
- Ensure all URLs are production URLs

## File Structure

Environment variables should be placed in `.env.local` (local development) or set in your deployment platform:

- **Local Development**: `.env.local` (git-ignored)
- **Example File**: `.env.example` (committed to git, no secrets)
- **Deployment**: Set via platform (Vercel, Railway, etc.)

## Validation

Environment variables are validated on application startup. If required variables are missing, the application will fail to start with a clear error message.

### Manual Validation

To manually validate your environment configuration:

```bash
# In Node.js REPL or script
import { validateEnvironment } from './src/lib/config/env-validation';
validateEnvironment();
```

### Validation Output

On startup, you'll see:
- ✅ Success message with current configuration (development only)
- ⚠️ Warnings for missing optional but recommended variables
- ❌ Errors for missing required variables (app won't start)

## Security Best Practices

1. **Never commit `.env.local`** - it's in `.gitignore`
2. **Use `.env.example`** - commit this with placeholder values
3. **Public vs Private**:
   - `NEXT_PUBLIC_*` variables are exposed to the client bundle
   - Variables without this prefix are server-only (more secure)
4. **Service Role Key**:
   - Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
   - Only use in server-side code (`/api/**`, server components)
5. **Sentry DSN**:
   - Can use `NEXT_PUBLIC_SENTRY_DSN` (public) or `SENTRY_DSN` (private)
   - Both work, but private is slightly more secure

## Using the Config in Code

### Server-Side

```typescript
import { getEnvConfig, supabase, app, sentry } from "@/lib/config/env";

// Full config
const config = getEnvConfig();
console.log(config.env); // "development" | "staging" | "production"

// Specific sections
const supabaseConfig = supabase();
const appConfig = app();
const sentryConfig = sentry();
```

### Client-Side

```typescript
// Only public variables are available
import { app, sentry } from "@/lib/config/env";

const siteUrl = app().siteUrl;
const sentryEnabled = sentry().enabled;
```

## Troubleshooting

### "Missing required environment variables" Error

1. Check that `.env.local` exists and contains required variables
2. Verify variable names match exactly (case-sensitive)
3. Restart the development server after changing `.env.local`

### Sentry Not Working in Development

Set `NEXT_PUBLIC_SENTRY_ENABLED=true` in your `.env.local`

### Wrong Environment Detected

Set `APP_ENV` explicitly (e.g., `APP_ENV=staging`)

### Variables Not Updating

1. Restart the development server
2. Clear Next.js cache: `rm -rf .next`
3. Verify `.env.local` is being loaded (check path)

## Migration from Direct `process.env` Usage

The codebase is gradually migrating from direct `process.env` access to the centralized config:

- ✅ Supabase clients use centralized config
- ✅ Sentry configs use centralized config
- ✅ Application config (site URL, price floor) uses centralized config
- ⚠️ Some legacy code may still use `process.env` directly (being updated)

## Example `.env.local` File

Create this file in `apps/admin/.env.local`:

```env
# Application
APP_ENV=development

# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application URLs
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000

# Sentry (OPTIONAL)
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENABLED=false
SENTRY_ORG=
SENTRY_PROJECT=

# Pricing
PRICE_FLOOR_GBP=0.99
```

## Related Documentation

- [Supabase Setup Guide](https://supabase.com/docs/guides/getting-started)
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

