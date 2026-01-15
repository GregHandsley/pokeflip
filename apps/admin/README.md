# Pokeflip Admin

This is the admin application for Pokeflip, a Pokemon card inventory and sales management system.

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm (or npm/yarn)
- A Supabase project (for database and storage)

### Environment Setup

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in required environment variables in `.env.local`:**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-only)

3. **Optional: Configure additional services:**
   - Sentry (error tracking)
   - Custom site URL
   - Price floor settings

See [ENV_CONFIG.md](./ENV_CONFIG.md) for detailed environment variable documentation.

### Installation

```bash
# Install dependencies (from monorepo root)
pnpm install

# Or if installing just this app
cd apps/admin
pnpm install
```

### Development

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The application will validate environment variables on startup and show any missing required variables.

## Testing

```bash
# Unit and integration tests
pnpm test

# Test UI (interactive)
pnpm test:ui

# Test coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

## Documentation

### User Documentation

- [User Guide](../docs/USER_GUIDE.md) - Complete user guide and workflows
- [API Documentation](../docs/API.md) - API endpoints reference

### Technical Documentation

- [Environment Configuration](./ENV_CONFIG.md) - Complete guide to environment variables
- [Input Sanitization](../INPUT_SANITIZATION.md) - Security measures for inputs and file uploads
- [Performance Optimizations](../PERFORMANCE_OPTIMIZATIONS.md) - Performance improvements and monitoring
- [Error Handling](./src/lib/ERROR_HANDLING.md) - Error handling and logging guide
- [Database Security](./src/lib/DATABASE_SECURITY.md) - Database security practices

## Project Structure

```
apps/admin/
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   ├── components/       # React components
│   ├── lib/             # Utilities and configuration
│   │   ├── config/      # Environment configuration
│   │   ├── supabase/    # Supabase clients
│   │   └── ...
│   └── ...
├── e2e/                 # End-to-end tests (Playwright)
├── .env.example         # Example environment variables
└── ENV_CONFIG.md        # Environment configuration documentation
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Supabase Documentation](https://supabase.com/docs) - Supabase guides and reference
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/) - Error tracking setup

## Deploy

The application can be deployed to any platform that supports Next.js:

- **Vercel** (recommended): Automatic deployments from git
- **Railway**: Simple deployment with environment variable management
- **Docker**: Containerize the application for any platform

Remember to set all required environment variables in your deployment platform!
