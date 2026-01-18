# Cloudflare Pages Settings - Final Configuration

## Update These Settings in Cloudflare Pages Dashboard

### 1. Root Directory

**Set to:** `apps/admin`

This ensures Cloudflare runs the build from `apps/admin`, giving Turbopack the correct directory context.

### 2. Build Command

**Set to:**

```bash
cd ../.. && pnpm install --no-frozen-lockfile && cd apps/admin && pnpm run build:cloudflare
```

This:

1. Goes to repo root (`../..`)
2. Installs all dependencies (`pnpm install --no-frozen-lockfile`)
3. Changes to `apps/admin`
4. Runs the Cloudflare build from the correct directory

### 3. Build Output Directory

**Set to:** `.vercel/output/static`

### 4. Node Version

**Set to:** `20`

## Why This Should Work

By setting the root directory to `apps/admin`, Cloudflare will:

- Run the build command from `apps/admin`
- Give Turbopack the correct directory context to find Next.js
- Still allow us to install from repo root (via `cd ../..`)
