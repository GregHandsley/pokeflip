# Hosting Guide for Pokeflip

## Overview

Pokeflip is a Next.js 16 application with:

- **Most routes**: Edge runtime (fast, serverless)
- **Some routes**: Node.js runtime (for Node.js-specific dependencies like `json2csv`)
- **Database**: Supabase (managed, separate hosting)
- **Storage**: Supabase Storage (for images/photos)
- **Monitoring**: Sentry

## Recommended Hosting: Vercel

**Vercel is the best fit** because:

✅ **Native Next.js support** - Built by Next.js creators  
✅ **Edge runtime support** - Your API routes using `export const runtime = "edge"` work out of the box  
✅ **Automatic Node.js runtime** - Routes with `export const runtime = "nodejs"` automatically use Node.js runtime  
✅ **Zero configuration** - Just connect your Git repo  
✅ **Free tier** - Generous free tier for personal projects  
✅ **Built-in CI/CD** - Automatic deployments on git push  
✅ **Environment variables** - Easy management through dashboard  
✅ **Preview deployments** - Every PR gets a preview URL

### Setup Steps

1. **Create Vercel account** at https://vercel.com
2. **Import your Git repository** (GitHub/GitLab/Bitbucket)
3. **Configure project**:
   - Root directory: `apps/admin`
   - Framework preset: Next.js (auto-detected)
   - Build command: `pnpm build` (or `npm run build`)
   - Output directory: `.next` (default)
   - Install command: `pnpm install` (or `npm install`)
4. **Add environment variables** in Vercel dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   SENTRY_AUTH_TOKEN=your-token
   ```
5. **Deploy** - Vercel will automatically build and deploy

### Vercel Configuration File (Optional)

Create `vercel.json` in the root if you need custom settings:

```json
{
  "buildCommand": "cd apps/admin && pnpm build",
  "devCommand": "cd apps/admin && pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/admin/.next"
}
```

### Monorepo Setup

If your Git repo has multiple apps, specify the root directory as `apps/admin` in Vercel project settings, or use the configuration above.

---

## Alternative Hosting Options

### 2. Cloudflare Pages

✅ **Pros**:

- Free tier with generous limits
- Edge runtime support (native)
- Excellent global CDN
- You already have `@cloudflare/next-on-pages` installed

❌ **Cons**:

- Requires adapter build step (`@cloudflare/next-on-pages`)
- Node.js runtime routes need workarounds (your `backup/full-export` route)
- More configuration needed than Vercel

**Setup**:

```bash
# Install adapter globally
pnpm add -D @cloudflare/next-on-pages

# Update next.config.ts
const nextConfig = {
  output: "export", // Or use adapter build
  // ... rest of config
}
```

### 3. Netlify

✅ **Pros**:

- Good Next.js support
- Free tier available
- Easy Git integration

❌ **Cons**:

- Edge runtime support is newer/less mature than Vercel
- May need additional configuration for Edge routes

### 4. Self-Hosted (Docker/VPS)

✅ **Pros**:

- Full control
- Can handle both Edge and Node.js routes easily

❌ **Cons**:

- Requires server management
- More setup and maintenance
- Need to configure reverse proxy (Nginx/Caddy)
- Handle SSL certificates yourself

**Docker Example**:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
WORKDIR /app/apps/admin
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## Environment Variables Checklist

Make sure these are set in your hosting platform:

### Required

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (private, server-only)

### Optional (Recommended)

- `SENTRY_ORG` - Sentry organization slug
- `SENTRY_PROJECT` - Sentry project name
- `SENTRY_AUTH_TOKEN` - Sentry auth token for source maps
- `NEXT_PUBLIC_SITE_URL` - Your site URL (for absolute URLs)
- `NODE_ENV` - Usually auto-set to `production` by hosting platform

---

## Database Hosting

Your database is already hosted on **Supabase**, which is perfect:

✅ Managed PostgreSQL  
✅ Built-in connection pooling  
✅ Automatic backups  
✅ Row Level Security (RLS)  
✅ Real-time subscriptions (if needed later)  
✅ Supabase Storage for file uploads

**No additional database hosting needed** - Supabase handles everything.

---

## Recommended Architecture

```
┌─────────────────┐
│   Vercel        │  ← Next.js app (Edge + Node.js routes)
│   (Hosting)     │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Supabase      │  ← PostgreSQL + Storage + Auth
│   (Database)    │
└─────────────────┘
         │
         │ Errors
         │
┌────────▼────────┐
│   Sentry        │  ← Error tracking + monitoring
│   (Monitoring)  │
└─────────────────┘
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Database migrations applied to production Supabase
- [ ] RLS policies tested in production
- [ ] Sentry configured and tested
- [ ] CORS settings verified (if using custom domains)
- [ ] Backup/export routes tested (Node.js runtime)
- [ ] Image uploads tested (Supabase Storage)
- [ ] Authentication flow tested
- [ ] Audit logging verified in production

---

## Cost Estimates

### Vercel

- **Hobby (Free)**: $0/month - Good for development/testing
  - Unlimited deployments
  - 100GB bandwidth
  - Serverless functions (Edge + Node.js)
- **Pro**: $20/month per user - For production
  - Everything in Hobby +
  - Analytics
  - Password protection for preview deployments

### Supabase

- **Free**: $0/month - Good for development
- **Pro**: $25/month - Recommended for production
  - 8GB database
  - 100GB bandwidth
  - Daily backups

### Sentry

- **Developer**: Free up to 5,000 events/month
- **Team**: $26/month - For production monitoring

**Total estimated cost**: $45-71/month for production setup

---

## Quick Start: Deploy to Vercel

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Navigate to admin app
cd apps/admin

# 4. Deploy
vercel

# 5. Follow prompts:
# - Link to existing project? (y/n) → n (first time)
# - Project name? → pokeflip-admin
# - Directory? → ./
# - Override settings? → n (use defaults)

# 6. Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 7. Deploy to production
vercel --prod
```

---

## Performance Optimization

Your app is already optimized:

✅ Edge runtime for most API routes (low latency)  
✅ Next.js 16 with React Server Components  
✅ Supabase connection pooling  
✅ Sentry error tracking

Consider adding:

- [ ] Image optimization (Next.js Image component - you may already be using this)
- [ ] CDN caching for static assets (Vercel handles this automatically)
- [ ] Database query optimization (add indexes as needed)
- [ ] API route caching (add `revalidate` headers where appropriate)

---

## Monitoring & Observability

You have Sentry configured, which is excellent. Consider:

1. **Uptime monitoring** - Use Vercel Analytics or UptimeRobot
2. **Database monitoring** - Supabase dashboard has built-in metrics
3. **Performance monitoring** - Vercel Analytics or Sentry Performance

---

## Security Best Practices

✅ Already implemented:

- Environment variable validation
- RLS policies in Supabase
- Input sanitization
- Audit logging

Additional recommendations:

- [ ] Enable Vercel's DDoS protection (automatic on Pro plan)
- [ ] Use Supabase's IP allowlist for service role key access
- [ ] Rotate service role key periodically
- [ ] Monitor Sentry for security-related errors
- [ ] Use strong CORS policies if needed

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Supabase Docs**: https://supabase.com/docs
- **Sentry Next.js**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
