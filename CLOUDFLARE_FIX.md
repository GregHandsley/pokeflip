# Cloudflare Pages Configuration Fix

## The Problem

Cloudflare Pages runs `pnpm install` **automatically** before your build command. When root directory is `apps/admin`, it tries to install from that directory, which fails because:

- Dependencies are managed at the monorepo root
- The lockfile is at the root
- Workspace dependencies aren't installed correctly

## The Solution

**Change these settings in Cloudflare Pages Dashboard:**

### Root Directory

**Change from:** `/apps/admin`  
**Change to:** Leave **empty** or `/` (repository root)

### Build Command

**Change from:** `cd ../.. && pnpm install && cd apps/admin && pnpm run build:cloudflare`  
**Change to:** `pnpm install --filter admin && pnpm --filter admin run build:cloudflare`

This uses pnpm's `--filter` flag to:

1. Install all dependencies from the root (respecting the lockfile)
2. Build only the `admin` workspace

### Build Output Directory

**Keep as:** `.vercel/output/static`

### Why This Works

- **Root directory = repository root**: Cloudflare runs `pnpm install` from the root, where the lockfile is
- **`--filter admin`**: Tells pnpm to work with the `admin` workspace, installing all its dependencies
- **No path navigation**: Avoids `cd` commands that can fail in CI environments

## Alternative: If Root Directory Must Be `apps/admin`

If you absolutely need root directory to be `apps/admin`, you'll need to bypass Cloudflare's automatic install:

### Option A: Skip Install in Build Command

```
SKIP_PNPM_INSTALL=true pnpm install --filter admin && pnpm --filter admin run build:cloudflare
```

Note: This may not work if Cloudflare always runs install first.

### Option B: Use Custom Install Script

Create a `install.sh` script in `apps/admin` that does:

```bash
#!/bin/bash
cd ../.. && pnpm install --filter admin
```

Then use: `./install.sh && pnpm run build:cloudflare`

However, **Option 1 (root directory = repo root) is recommended** as it's simpler and more reliable.

## Final Configuration

| Setting                    | Value                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| **Root directory**         | (empty or `/` - repository root)                                          |
| **Build command**          | `pnpm install --filter admin && pnpm --filter admin run build:cloudflare` |
| **Build output directory** | `.vercel/output/static`                                                   |
| **Node version**           | `20`                                                                      |

## Testing Locally

Test this build command locally from the repo root:

```bash
cd /path/to/pokeflip
pnpm install --filter admin && pnpm --filter admin run build:cloudflare
```

If this works locally, it should work on Cloudflare Pages.
