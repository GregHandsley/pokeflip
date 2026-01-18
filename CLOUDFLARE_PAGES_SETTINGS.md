# Cloudflare Pages Settings (Final Configuration)

## Update These Settings in Cloudflare Pages Dashboard

### 1. Root Directory

**Set to:** Repository root (leave empty or `/`)

**NOT** `apps/admin` - this causes Cloudflare to run `pnpm install` from there, which fails.

### 2. Build Command

**Set to:**

```bash
pnpm install --no-frozen-lockfile && pnpm --filter admin run build:cloudflare
```

**OR** if `--no-frozen-lockfile` doesn't work:

```bash
pnpm install && pnpm --filter admin run build:cloudflare
```

The `--no-frozen-lockfile` flag allows pnpm to update the lockfile if needed, which bypasses Vercel's strict lockfile check.

### 3. Build Output Directory

**Set to:** `.vercel/output/static`

### 4. Node Version

**Set to:** `20`

## Why `--no-frozen-lockfile`?

Cloudflare Pages runs `pnpm install --frozen-lockfile` by default, which:

1. Checks if lockfile matches `package.json`
2. In monorepos, this fails because dependencies are in workspace packages, not root

Using `--no-frozen-lockfile` in our build command:

- Allows pnpm to adjust the lockfile if needed
- Bypasses Vercel's strict check inside `next-on-pages`
- Works correctly with pnpm workspaces

## Alternative: If `--no-frozen-lockfile` Doesn't Work

If the above still fails, try this build command:

```bash
pnpm install --filter admin && cd apps/admin && pnpm run build:cloudflare
```

This installs only the `admin` workspace dependencies, which might avoid the lockfile check.

## Testing Locally

Test this command locally:

```bash
cd /path/to/pokeflip
pnpm install --no-frozen-lockfile && pnpm --filter admin run build:cloudflare
```

If it works locally, it should work on Cloudflare Pages.

## Next Steps

1. Update Cloudflare Pages settings as above
2. Save and trigger a new deployment
3. Check build logs to verify it works
