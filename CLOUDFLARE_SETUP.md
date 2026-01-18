# Cloudflare Pages Setup Guide

This guide will help you deploy Pokeflip to Cloudflare Pages, addressing common issues.

## Prerequisites

- Cloudflare account (free tier works)
- Git repository (GitHub, GitLab, or Bitbucket)
- Supabase project (already set up)

## Step 1: Install Dependencies

You already have `@cloudflare/next-on-pages` installed. Verify it's available:

```bash
cd apps/admin
pnpm list @cloudflare/next-on-pages
```

## Step 2: Build Configuration

The project is configured for Cloudflare Pages. Key changes:

1. **Edge Runtime**: Most routes use `export const runtime = "edge"` (already done)
2. **CSV Generation**: The backup route now uses Edge-compatible CSV generation (no Node.js `stream` required)
3. **Next.js Config**: Added Cloudflare detection for image optimization

## Step 3: Cloudflare Pages Setup

### Option A: Via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard** → Pages → Create a project

2. **Connect your Git repository**

3. **Configure build settings**:

   ```
   Framework preset: None
   Root directory: apps/admin
   Build command: pnpm install && pnpm run build:cloudflare
   Build output directory: .vercel/output/static
   Node version: 20
   ```

4. **Add Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `SENTRY_ORG` = (optional) your Sentry org
   - `SENTRY_PROJECT` = (optional) your Sentry project
   - `SENTRY_AUTH_TOKEN` = (optional) your Sentry token

5. **Save and Deploy**

### Option B: Via Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Navigate to admin app
cd apps/admin

# Build for Cloudflare
pnpm run build:cloudflare

# Deploy (first time)
wrangler pages deploy .vercel/output/static --project-name=pokeflip-admin

# Or deploy to preview
wrangler pages deploy .vercel/output/static --project-name=pokeflip-admin --branch=preview
```

## Step 4: Verify Deployment

After deployment, check:

1. **Visit your Cloudflare Pages URL** (provided after deployment)
2. **Test key features**:
   - Login/authentication
   - Database queries (Supabase connection)
   - API routes
   - Export functionality (should work with Edge runtime now)

## Common Issues & Solutions

### Issue 1: Build Fails - Module Not Found

**Error**: `Cannot find module 'stream'` or similar Node.js modules

**Solution**: The backup route has been updated to use Edge-compatible CSV generation. If you see this error:

- Ensure you're using the latest code with the CSV fix
- Check that `export const runtime = "edge"` is set (not "nodejs")

### Issue 2: Build Fails - json2csv Not Found

**Error**: `Module not found: Can't resolve 'json2csv'`

**Solution**: The backup route no longer uses `json2csv` for CSV export. It uses a simple Edge-compatible CSV generator. If you still see this:

- The `json2csv` package is still in `package.json` but not imported in the backup route
- This is fine - it won't cause issues as long as it's not imported

### Issue 3: Environment Variables Not Working

**Error**: Missing environment variables at runtime

**Solution**:

- Ensure all required variables are set in Cloudflare Pages dashboard
- Variable names must match exactly (case-sensitive)
- Redeploy after adding new variables

### Issue 4: API Routes Return 404

**Error**: API routes not found

**Solution**:

- Verify build completed successfully with `@cloudflare/next-on-pages`
- Check that `.vercel/output/static` contains the built files
- Ensure API routes are in `src/app/api/` (not `pages/api/`)

### Issue 5: Images Not Loading

**Error**: Next.js Image component fails

**Solution**:

- Next.js config sets `images.unoptimized = true` for Cloudflare builds
- Use standard `<img>` tags or handle images via Supabase Storage
- Or use Cloudflare Images service

### Issue 6: Monorepo Issues

**Error**: Can't find workspace dependencies

**Solution**:

- Set root directory to `apps/admin` in Cloudflare Pages settings
- Or install dependencies at root level first:
  ```bash
  pnpm install --filter admin
  ```

## Build Script Explanation

The `build:cloudflare` script:

```json
"build:cloudflare": "npm run build && npx @cloudflare/next-on-pages"
```

1. `npm run build` - Builds Next.js app normally
2. `npx @cloudflare/next-on-pages` - Converts Next.js output to Cloudflare Pages format

This creates `.vercel/output/static` which Cloudflare Pages serves.

## Testing Locally

Test the Cloudflare build locally:

```bash
cd apps/admin

# Build for Cloudflare
pnpm run build:cloudflare

# Preview locally (if you have Wrangler)
wrangler pages dev .vercel/output/static

# Or use Wrangler's local dev server
wrangler pages dev .vercel/output/static --compatibility-date=2024-01-01
```

## File Structure After Build

After `build:cloudflare`, you should see:

```
apps/admin/
├── .vercel/
│   └── output/
│       └── static/    ← This is what Cloudflare Pages serves
├── .next/             ← Standard Next.js build output
└── ...
```

## Continuous Deployment

Once set up, Cloudflare Pages will:

- Automatically deploy on git push to main branch
- Create preview deployments for pull requests
- Handle environment variables per branch

## Monitoring

Monitor your deployment:

- **Cloudflare Dashboard** → Pages → Your project → Deployments
- **Build logs**: View build output in real-time
- **Analytics**: Built-in analytics available

## Cost

**Cloudflare Pages (Free Tier)**:

- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ Unlimited deployments
- ✅ Custom domains
- ✅ Preview deployments
- ✅ DDoS protection

Perfect for personal/small business projects!

## Differences from Vercel

| Feature         | Vercel              | Cloudflare Pages        |
| --------------- | ------------------- | ----------------------- |
| Edge Runtime    | Native              | Via adapter             |
| Node.js Runtime | Native              | Not supported           |
| Build Time      | ~2-5 min            | ~3-8 min (with adapter) |
| Cold Start      | Very fast           | Very fast               |
| Cost            | Free tier available | Free tier available     |
| Setup           | Easier              | Requires adapter        |

**Note**: Your app now uses Edge runtime everywhere, so Node.js runtime limitations don't apply.

## Troubleshooting

If you encounter issues:

1. **Check build logs** in Cloudflare Pages dashboard
2. **Verify environment variables** are set correctly
3. **Test locally** with `pnpm run build:cloudflare`
4. **Check Node version** (should be 20+)
5. **Verify adapter output** exists in `.vercel/output/static`

## Support Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)

## Next Steps

After successful deployment:

1. ✅ Set up custom domain (optional)
2. ✅ Configure DNS if using custom domain
3. ✅ Test all features thoroughly
4. ✅ Set up monitoring/alerts
5. ✅ Configure backup strategy for Supabase
