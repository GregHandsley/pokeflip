# Pokeflip

A comprehensive Pokemon card inventory and sales management system built with Next.js, Supabase, and TypeScript.

## Overview

Pokeflip is a full-featured inventory management system for Pokemon card collections, enabling:
- **Inventory Management**: Track cards, lots, variations, and quantities
- **Sales Processing**: Record sales, calculate profits, and manage orders
- **Acquisitions**: Add new purchases and process intake lines
- **Bundles**: Create and sell card bundles
- **Analytics**: Track sales volume, inventory levels, and profitability
- **Integration**: eBay inbox and order synchronization
- **Monitoring**: Health checks, performance metrics, and alerting

## Architecture

```
pokeflip/
├── apps/
│   └── admin/          # Next.js admin application (main app)
├── packages/
│   └── shared/         # Shared TypeScript utilities
├── supabase/           # Database migrations and config
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest, Playwright
- **Monitoring**: Sentry
- **Package Manager**: pnpm (workspaces)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Supabase account (or self-hosted Supabase)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd pokeflip
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cd apps/admin
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. **Set up the database:**
   ```bash
   # If using Supabase CLI
   supabase migration up
   
   # Or apply migrations manually via Supabase dashboard
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```

6. **Open the application:**
   ```
   http://localhost:3000
   ```

For detailed setup instructions, see [apps/admin/README.md](./apps/admin/README.md).

## Project Structure

### Apps

- **`apps/admin/`** - Main admin application
  - Next.js application with App Router
  - API routes for all backend functionality
  - React components for UI
  - Configuration and utilities

### Packages

- **`packages/shared/`** - Shared TypeScript code
  - Common types and utilities
  - Reusable business logic

### Database

- **`supabase/migrations/`** - Database migrations
  - Sequential SQL migration files
  - Applied in order via migration timestamp

### Documentation

- **`docs/`** - Project documentation
  - API documentation
  - User guides
  - Technical documentation

### Scripts

- **`scripts/`** - Utility scripts
  - Backup/restore scripts
  - Database testing scripts

## Key Features

### Inventory Management
- Track individual cards with variations (condition, language, etc.)
- Manage inventory lots (quantity, status, pricing)
- Bulk operations (merge, split lots)
- Photo uploads for physical cards

### Sales Processing
- Record sales orders with buyers
- Calculate profits (revenue, costs, margins)
- Handle discounts and promotional deals
- Track consumables (packaging materials)
- Export sales data to CSV

### Acquisitions
- Add new card purchases
- Process intake lines with photos
- Commit acquisitions to inventory
- Track purchase costs and profitability

### Bundles
- Create bundles of multiple cards
- Set bundle prices
- Track bundle inventory
- Record bundle sales

### Analytics & Reporting
- Sales volume tracking
- Inventory level monitoring
- Profit analysis
- Performance metrics

### Integrations
- eBay inbox synchronization
- eBay order management
- OAuth authentication

### Monitoring & Alerts
- Health check endpoint (`/api/health`)
- API response time tracking
- Error alerting (Sentry integration)
- Business metrics dashboard

## Development

### Running the Development Server

```bash
# From root (runs all apps)
pnpm dev

# From apps/admin (single app)
cd apps/admin
pnpm dev
```

### Running Tests

```bash
# Unit tests
pnpm test

# Test with UI
pnpm test:ui

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

## Environment Variables

See [apps/admin/ENV_CONFIG.md](./apps/admin/ENV_CONFIG.md) for complete environment variable documentation.

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Optional:**
- Sentry configuration
- Site URL
- Price floor settings

## Database

The application uses Supabase (PostgreSQL) for data storage.

### Migrations

Database migrations are in `supabase/migrations/` and are applied sequentially based on timestamp.

### Schema Overview

Key tables:
- `cards` - Card catalog data
- `sets` - Pokemon card sets
- `inventory_lots` - Inventory lots
- `sales_orders` - Sales transactions
- `sales_items` - Individual items in sales
- `acquisitions` - Card purchases
- `buyers` - Customer information
- `bundles` - Card bundles

### Views

- `v_sales_order_profit` - Calculated profit data per order
- `v_consumable_costs` - Average consumable costs
- `v_card_inventory_totals` - Card inventory summaries

## API Documentation

See [docs/API.md](./docs/API.md) for complete API endpoint documentation.

### Key Endpoints

- `GET /api/health` - Health check
- `GET /api/admin/monitoring/metrics` - Business metrics
- `GET /api/admin/dashboard/summary` - Dashboard summary
- `POST /api/admin/sales/create` - Create sales order
- `GET /api/admin/inventory/cards` - List inventory cards

## User Guide

See [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) for user workflows and guides.

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- Railway
- Docker containers
- Self-hosted servers

Ensure all required environment variables are set in your deployment platform.

## Documentation

- [Admin App README](./apps/admin/README.md) - Admin application setup
- [Environment Configuration](./apps/admin/ENV_CONFIG.md) - Environment variables
- [API Documentation](./docs/API.md) - API endpoints reference
- [User Guide](./docs/USER_GUIDE.md) - User workflows and guides
- [Error Handling](./apps/admin/src/lib/ERROR_HANDLING.md) - Error handling guide
- [Database Security](./apps/admin/src/lib/DATABASE_SECURITY.md) - Security practices

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub.

