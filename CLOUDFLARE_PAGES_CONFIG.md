# Cloudflare Pages Configuration

## Current Issue

Cloudflare Pages is running `pnpm install` from the repository root and checking the root `package.json` against the root lockfile. However, in a monorepo:

- Dependencies are in `apps/admin/package.json`, not the root `package.json`
- The root lockfile is correct (includes all workspace dependencies)
- But Cloudflare's check fails because root `package.json` doesn't list those deps

## Solution: Update Cloudflare Pages Settings

### Step 1: Set Root Directory

In Cloudflare Pages Dashboard:

1. Go to **Pages** → Your Project → **Settings** → **Builds & deployments**
2. Find **Root directory** setting
3. Change it to: `apps/admin`
4. Save

### Step 2: Update Build Command

**Option A: If Root Directory = `apps/admin`** (Recommended)

Build command:

```
cd ../.. && pnpm install && cd apps/admin && pnpm run build:cloudflare
```

This:

1. Goes to repo root (`../..`)
2. Installs all workspace dependencies (`pnpm install`)
3. Changes to `apps/admin`
4. Runs the Cloudflare build

**Option B: If Root Directory = Repository Root**

Build command:

```
pnpm install --filter admin && pnpm run --filter admin build:cloudflare
```

This uses pnpm's workspace filtering to install and build only the admin app.

### Step 3: Set Output Directory

**Output directory**: `.vercel/output/static`

This is where `@cloudflare/next-on-pages` outputs the build.

### Step 4: Node Version

**Node version**: `20` (or match your `.nvmrc` or `package.json` engines)

## Why This Fixes It

Setting root directory to `apps/admin` makes Cloudflare:

- Look for `package.json` in `apps/admin` (which has all the dependencies)
- Still use the root `pnpm-lock.yaml` (which is correct for monorepos)
- Run build commands from `apps/admin` context

The build command with `cd ../..` ensures we:

- Install from monorepo root (where lockfile is)
- Build from `apps/admin` (where the app is)

## Alternative: Simplified Build Command

If the above doesn't work, try this build command (with root directory = `apps/admin`):

```
../../node_modules/.bin/pnpm install && pnpm run build:cloudflare
```

Or if root directory = repo root:

```
pnpm install --no-frozen-lockfile && cd apps/admin && pnpm run build:cloudflare
```

Note: `--no-frozen-lockfile` allows pnpm to update the lockfile if needed, which Cloudflare's frozen check might require.

## Final Configuration Summary

**Recommended Settings:**

| Setting              | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Root directory**   | `apps/admin`                                                             |
| **Build command**    | `cd ../.. && pnpm install && cd apps/admin && pnpm run build:cloudflare` |
| **Output directory** | `.vercel/output/static`                                                  |
| **Node version**     | `20`                                                                     |

## After Making Changes

1. Save settings in Cloudflare Pages dashboard
2. Trigger a new deployment (or push a commit)
3. Monitor build logs to verify it works

If it still fails, check the build logs to see if the lockfile check is still happening, and adjust the build command accordingly.
