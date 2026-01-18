# Cloudflare Pages Final Fix

## The Core Problem

`@cloudflare/next-on-pages` internally runs `vercel build`, which:

1. Runs `pnpm install --frozen-lockfile` from the repository root
2. Checks the root `package.json` against the root lockfile
3. In a monorepo, this fails because dependencies are in `apps/admin/package.json`, not the root

## The Solution

We need to **skip Vercel's automatic install** and handle it ourselves. Update your Cloudflare Pages settings:

### Root Directory

**Set to:** Repository root (leave empty or `/`)

### Build Command

**Set to:**

```bash
pnpm install --filter admin && cd apps/admin && SKIP_ENV_VALIDATION=1 VERCEL=1 pnpm run build:cloudflare
```

Or if that doesn't work:

```bash
SKIP_VERCEL_BUILD_INSTALL=1 pnpm install --filter admin && cd apps/admin && SKIP_ENV_VALIDATION=1 VERCEL=1 pnpm run build:cloudflare
```

### Build Output Directory

**Set to:** `.vercel/output/static`

### Node Version

**Set to:** `20`

## What These Environment Variables Do

- `SKIP_ENV_VALIDATION=1`: Tells Next.js to skip environment variable validation
- `VERCEL=1`: Indicates we're in a Vercel-like environment (needed by `next-on-pages`)
- `SKIP_VERCEL_BUILD_INSTALL=1`: (If it exists) Tells Vercel to skip its automatic install

## Alternative: Bypass next-on-pages' Internal Install

If the above doesn't work, we can modify the `build:cloudflare` script to bypass Vercel's install check. However, this is tricky because `next-on-pages` calls `vercel build` internally.

## Testing Locally

Test the build command locally:

```bash
cd /path/to/pokeflip
pnpm install --filter admin && cd apps/admin && SKIP_ENV_VALIDATION=1 VERCEL=1 pnpm run build:cloudflare
```

## If It Still Fails

If it still fails with the lockfile error, the issue is that `vercel build` (called by `next-on-pages`) is still checking the lockfile. In that case:

1. **Regenerate lockfile** to ensure it's in sync:

   ```bash
   cd /path/to/pokeflip
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "Update lockfile"
   ```

2. **Or try a different approach**: Use `npx vercel build` directly with custom flags, or use a different deployment method.

## Current Status

The `build:cloudflare` script has been updated to include `SKIP_ENV_VALIDATION=1 VERCEL=1` environment variables. This should help with the build process, but the main issue is still the lockfile check inside `vercel build`.
