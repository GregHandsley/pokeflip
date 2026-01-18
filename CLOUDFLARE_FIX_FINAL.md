# Cloudflare Pages Fix - Final Solution

## The Problem

`@cloudflare/next-on-pages` internally runs `vercel build`, which:

1. Runs `pnpm install --frozen-lockfile` from the repository root
2. Checks the root `package.json` against the root lockfile
3. **Fails** because in a monorepo, dependencies are in workspace packages (`apps/admin/package.json`), not the root

## Root Cause

The lockfile check fails because:

- Root `package.json` has only `devDependencies` (workspace tools)
- Lockfile contains dependencies from `apps/admin/package.json` (actual app dependencies)
- `vercel build` expects root `package.json` to match the lockfile

## Fix Applied

1. **Removed duplicate lockfile**: Deleted `apps/admin/pnpm-lock.yaml` - only root should have lockfile in monorepo
2. **Removed workspace config**: Deleted `apps/admin/pnpm-workspace.yaml` - root manages workspaces

## Cloudflare Pages Settings

### Root Directory

**Set to:** Repository root (leave empty or `/`)

### Build Command

**Set to:**

```bash
pnpm install --no-frozen-lockfile && pnpm --filter admin run build:cloudflare
```

The `--no-frozen-lockfile` flag bypasses Vercel's strict lockfile check.

### Build Output Directory

**Set to:** `.vercel/output/static`

### Node Version

**Set to:** `20`

## Why This Should Work Now

1. **No duplicate lockfiles**: Only root has lockfile, so Next.js won't be confused about workspace root
2. **`--no-frozen-lockfile`**: Allows pnpm to adjust lockfile during install, bypassing Vercel's check
3. **Workspace filtering**: `--filter admin` ensures we only build what's needed

## Testing

After committing these changes:

1. Push to your repository
2. Cloudflare Pages will auto-deploy
3. Check build logs - it should now succeed

## If It Still Fails

If `vercel build` still runs its own `pnpm install --frozen-lockfile`, we may need to:

1. **Patch next-on-pages** to skip install (complex)
2. **Move to OpenNext** (alternative adapter)
3. **Use Vercel instead** (native Next.js support, no adapter needed)

But try the current fix first - removing the duplicate lockfile and using `--no-frozen-lockfile` should resolve it.
