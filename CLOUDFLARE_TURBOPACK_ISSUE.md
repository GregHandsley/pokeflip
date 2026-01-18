# Cloudflare Pages Turbopack Root Issue

## The Problem

The build fails with:

```
Error: Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory: /opt/buildhome/repo/apps/admin/src/app
To fix this, set turbopack.root in your Next.js config
```

However, **`turbopack.root` is NOT available in Next.js 16.1.1** - it's not in the `ExperimentalConfig` type definition.

## Root Cause

When `@cloudflare/next-on-pages` runs `vercel build`, which then runs `pnpm run build` from `apps/admin`, Turbopack is looking for the Next.js package from `/opt/buildhome/repo/apps/admin/src/app` instead of `/opt/buildhome/repo/apps/admin`.

## Solution Options

### Option 1: Wait for Next.js Update (Not Immediate)

The `turbopack.root` config option might be available in a newer version of Next.js, but upgrading might break other things.

### Option 2: Disable Turbopack (Use Webpack Instead)

Since `turbopack.root` isn't available, we could try to force Next.js to use webpack instead of Turbopack. However, Next.js 16.1.1 might use Turbopack by default and this might not be configurable.

### Option 3: Change Build Directory Context

The real issue is that `vercel build` (called by `next-on-pages`) is running from `apps/admin`, but the directory context is wrong. We might need to ensure the build command runs from the correct directory.

### Option 4: Use a Different Adapter

Since `@cloudflare/next-on-pages` is having issues with monorepos, consider:

- **OpenNext** (alternative adapter)
- **Vercel** (native Next.js support, no adapter needed)

## Current Status

The `turbopack.root` config option doesn't exist in Next.js 16.1.1, so we can't use it. We need a different solution.

## Next Steps

1. **Try disabling Turbopack** - Check if there's a way to force webpack
2. **Adjust build command** - Ensure `vercel build` runs with correct directory context
3. **Consider alternative adapters** - OpenNext or Vercel might handle monorepos better
