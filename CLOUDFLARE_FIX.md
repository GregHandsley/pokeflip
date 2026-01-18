# Cloudflare Pages Build Fix

## Problem

`@cloudflare/next-on-pages` internally uses Vercel's build system which runs `pnpm install --frozen-lockfile` from the repository root. This fails in monorepos because Vercel checks the root `package.json` against the root lockfile, but dependencies are in workspace packages.

## Solution: Update Cloudflare Pages Settings

The issue is that Cloudflare Pages needs to be configured to:

1. Set **Root directory** to `apps/admin` (not repository root)
2. Or use a build command that doesn't trigger Vercel's lockfile check

### Option 1: Set Root Directory (Recommended)

In Cloudflare Pages dashboard:

- **Root directory**: `apps/admin`
- **Build command**: `pnpm install && pnpm run build:cloudflare`
- **Output directory**: `.vercel/output/static`
- **Node version**: `20`

This makes Cloudflare Pages treat `apps/admin` as the project root, so the lockfile check works correctly.

### Option 2: Use Different Build Command

If you can't change root directory, update the build command to:

```
cd apps/admin && pnpm install --no-frozen-lockfile && pnpm run build:cloudflare
```

However, this may not work because `@cloudflare/next-on-pages` internally runs `vercel build` which also checks the lockfile.

### Option 3: Use OpenNext Instead (Future)

The `@cloudflare/next-on-pages` package is deprecated in favor of OpenNext. Consider migrating to OpenNext for better monorepo support:

```bash
pnpm add -D @opennextjs/cloudflare
```

Then update `build:cloudflare` to use OpenNext instead.

## Current Status

Your build is failing because:

1. Root directory is set to repository root (default)
2. Vercel's build checks root `package.json` vs root lockfile
3. Dependencies are in `apps/admin/package.json` (monorepo workspace)

## Quick Fix

**Update Cloudflare Pages settings:**

1. Go to Cloudflare Dashboard → Pages → Your Project → Settings
2. Set **Root directory**: `apps/admin`
3. Keep build command: `pnpm install && pnpm run build:cloudflare`
4. Redeploy

This should resolve the lockfile mismatch error.
