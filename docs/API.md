# API Documentation

Complete reference for all API endpoints in the Pokeflip application.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Your deployed URL

## Authentication

Most API endpoints require authentication via Supabase session. Sessions are managed client-side and sent as cookies/headers automatically by the Supabase client.

## Response Format

All API responses follow a standard format:

### Success Response
```json
{
  "ok": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Endpoints

### Health & Monitoring

#### `GET /api/health`
Health check endpoint for monitoring system availability.

**Response:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-01-10T22:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy" | "unhealthy",
      "responseTimeMs": 45,
      "error": "optional error message"
    },
    "uptime": {
      "seconds": 3600
    }
  },
  "version": "optional version string"
}
```

**Status Codes:**
- `200` - Healthy or degraded
- `503` - Unhealthy

---

#### `GET /api/admin/monitoring/metrics`
Get business metrics (sales volume, inventory levels).

**Query Parameters:**
- `days` (number, optional): Number of days for recent sales calculation (default: 7, max: 365)

**Response:**
```json
{
  "ok": true,
  "metrics": {
    "sales": {
      "totalSalesCount": 150,
      "totalRevenuePence": 150000,
      "recentSalesCount": 10,
      "recentRevenuePence": 10000,
      "averageOrderValuePence": 1000,
      "timestamp": "2026-01-10T22:00:00.000Z"
    },
    "inventory": {
      "totalLots": 500,
      "activeLots": 400,
      "listedLots": 350,
      "soldLots": 100,
      "totalQuantity": 5000,
      "availableQuantity": 3500,
      "lowStockThreshold": 50,
      "timestamp": "2026-01-10T22:00:00.000Z"
    },
    "timestamp": "2026-01-10T22:00:00.000Z"
  }
}
```

---

#### `GET /api/admin/performance/metrics`
Get performance metrics (database, indexes, caching).

**Response:**
```json
{
  "ok": true,
  "metrics": {
    "database": {
      "status": "connected",
      "queryTimeMs": 45,
      "error": null
    },
    "indexes": {
      "total": 10,
      "active": 10,
      "details": [...]
    },
    "cache": { ... },
    "optimizations": { ... },
    "timestamp": "2026-01-10T22:00:00.000Z"
  }
}
```

---

### Dashboard

#### `GET /api/admin/dashboard/summary`
Get dashboard summary data.

**Response:**
```json
{
  "ok": true,
  "inbox": {
    "readyToList": 25,
    "needsPhotos": 10,
    "highValueReady": 5
  },
  "purchases": {
    "open": 2
  },
  "inventory": {
    "total": 500,
    "listed": 350
  },
  "recentSales": {
    "count": 10,
    "revenue_pence": 10000
  },
  "overallProfit": {
    "purchase_cost_pence": 100000,
    "revenue_pence": 150000,
    "consumables_cost_pence": 5000,
    "total_costs_pence": 105000,
    "net_profit_pence": 45000,
    "margin_percent": 30
  }
}
```

---

### Sales

#### `POST /api/admin/sales/create`
Create a new sales order.

**Request Body:**
```json
{
  "buyerId": "uuid",
  "platform": "ebay" | "other",
  "platformOrderRef": "string (optional)",
  "orderGroup": "string (optional)",
  "soldAt": "2026-01-10T22:00:00.000Z",
  "discountPence": 0,
  "items": [
    {
      "lotId": "uuid",
      "qty": 1,
      "soldPricePence": 1000
    }
  ],
  "consumables": [
    {
      "consumableId": "uuid",
      "qty": 1
    }
  ],
  "feesPence": 0,
  "shippingPence": 0
}
```

**Response:**
```json
{
  "ok": true,
  "order": {
    "id": "uuid",
    "sold_at": "2026-01-10T22:00:00.000Z",
    ...
  }
}
```

---

#### `GET /api/admin/sales/orders`
Get all sales orders.

**Response:**
```json
{
  "ok": true,
  "orders": [
    {
      "id": "uuid",
      "sold_at": "2026-01-10T22:00:00.000Z",
      "buyer": {
        "handle": "buyer123"
      },
      "sales_items": [...]
    }
  ]
}
```

---

#### `GET /api/admin/sales/overall-profit`
Get overall profit data.

**Response:**
```json
{
  "ok": true,
  "totalPurchaseCostPence": 100000,
  "totalRevenuePence": 150000,
  "totalConsumablesCostPence": 5000,
  "totalCostsPence": 105000,
  "netProfitPence": 45000,
  "marginPercent": 30
}
```

---

#### `GET /api/admin/sales/listed-lots`
Get all lots available for sale.

**Response:**
```json
{
  "ok": true,
  "lots": [
    {
      "id": "uuid",
      "quantity": 1,
      "availableQuantity": 1,
      "listPricePence": 1000,
      "status": "listed",
      "card": { ... }
    }
  ]
}
```

---

### Inventory

#### `GET /api/admin/inventory/cards`
Get all inventory cards with totals.

**Query Parameters:**
- `setId` (string, optional): Filter by set ID
- `search` (string, optional): Search by card name

**Response:**
```json
{
  "ok": true,
  "cards": [
    {
      "id": "uuid",
      "name": "Pikachu",
      "number": "25",
      "rarity": "Common",
      "set": { ... },
      "qtyOnHand": 10,
      "qtyForSale": 8,
      "qtySold": 2
    }
  ]
}
```

---

#### `GET /api/admin/inventory/cards/[cardId]/lots`
Get all lots for a specific card.

**Response:**
```json
{
  "ok": true,
  "lots": [
    {
      "id": "uuid",
      "quantity": 1,
      "availableQuantity": 1,
      "status": "listed",
      "condition": "Near Mint",
      ...
    }
  ]
}
```

---

### Acquisitions

#### `GET /api/admin/acquisitions/[acquisitionId]/lots`
Get all lots for an acquisition.

**Response:**
```json
{
  "ok": true,
  "lots": [...]
}
```

---

#### `GET /api/admin/acquisitions/[acquisitionId]/profit`
Get profit analysis for an acquisition.

**Response:**
```json
{
  "ok": true,
  "acquisition": {
    "id": "uuid",
    "purchase_total_pence": 10000,
    ...
  },
  "totalRevenuePence": 15000,
  "totalProfitPence": 5000,
  "marginPercent": 33.33,
  "sales": [...]
}
```

---

### Bundles

#### `GET /api/admin/bundles`
Get all bundles.

**Response:**
```json
{
  "ok": true,
  "bundles": [
    {
      "id": "uuid",
      "name": "Starter Bundle",
      "quantity": 10,
      "pricePence": 5000,
      "items": [...],
      ...
    }
  ]
}
```

---

#### `POST /api/admin/bundles`
Create a new bundle.

**Request Body:**
```json
{
  "name": "Starter Bundle",
  "description": "Great starter pack",
  "quantity": 10,
  "pricePence": 5000,
  "items": [
    {
      "lotId": "uuid",
      "quantity": 1
    }
  ]
}
```

---

#### `PATCH /api/admin/bundles/[bundleId]`
Update a bundle.

**Request Body:**
```json
{
  "name": "Updated Bundle Name",
  "pricePence": 6000,
  "quantity": 12
}
```

---

#### `POST /api/admin/bundles/[bundleId]/sell`
Sell a bundle.

**Request Body:**
```json
{
  "buyerId": "uuid",
  "soldAt": "2026-01-10T22:00:00.000Z",
  "discountPence": 0
}
```

---

### Lots

#### `GET /api/admin/lots/[lotId]`
Get a specific lot.

**Response:**
```json
{
  "ok": true,
  "lot": {
    "id": "uuid",
    "quantity": 1,
    "status": "listed",
    "card": { ... },
    ...
  }
}
```

---

#### `PATCH /api/admin/lots/[lotId]/status`
Update lot status.

**Request Body:**
```json
{
  "status": "listed" | "ready" | "draft" | "sold" | "archived"
}
```

---

#### `PATCH /api/admin/lots/[lotId]/for-sale`
Update lot for-sale flag.

**Request Body:**
```json
{
  "forSale": true,
  "listPricePence": 1000
}
```

---

#### `POST /api/admin/lots/merge`
Merge multiple lots into one.

**Request Body:**
```json
{
  "lotIds": ["uuid1", "uuid2"],
  "targetLotId": "uuid1"
}
```

---

#### `POST /api/admin/lots/[lotId]/split`
Split a lot into multiple lots.

**Request Body:**
```json
{
  "splits": [
    {
      "quantity": 5,
      "status": "listed"
    },
    {
      "quantity": 3,
      "status": "ready"
    }
  ]
}
```

---

### Inbox

#### `GET /api/admin/inbox/lots`
Get all inbox lots (draft/ready status).

**Response:**
```json
{
  "ok": true,
  "lots": [...]
}
```

---

#### `GET /api/admin/inbox/count`
Get inbox counts.

**Response:**
```json
{
  "ok": true,
  "readyToList": 25,
  "needsPhotos": 10,
  "highValueReady": 5
}
```

---

#### `POST /api/admin/inbox/lots/bulk`
Bulk update inbox lots.

**Request Body:**
```json
{
  "lotIds": ["uuid1", "uuid2"],
  "updates": {
    "status": "ready",
    "forSale": true
  }
}
```

---

### Consumables

#### `GET /api/admin/consumables`
Get all consumables.

**Response:**
```json
{
  "ok": true,
  "consumables": [
    {
      "id": "uuid",
      "name": "Bubble Mailer",
      "unit": "each",
      ...
    }
  ]
}
```

---

#### `POST /api/admin/consumables`
Create a consumable.

**Request Body:**
```json
{
  "name": "Bubble Mailer",
  "unit": "each"
}
```

---

#### `POST /api/admin/consumables/purchases`
Record a consumable purchase.

**Request Body:**
```json
{
  "consumableId": "uuid",
  "qty": 100,
  "totalCostPence": 5000
}
```

---

### Promotional Deals

#### `GET /api/admin/promotional-deals`
Get all promotional deals.

**Query Parameters:**
- `activeOnly` (boolean, optional): Only return active deals

**Response:**
```json
{
  "ok": true,
  "deals": [
    {
      "id": "uuid",
      "name": "Buy 2 Get 1 Free",
      "deal_type": "buy_x_get_y",
      "is_active": true,
      ...
    }
  ]
}
```

---

#### `POST /api/admin/promotional-deals`
Create a promotional deal.

**Request Body:**
```json
{
  "name": "Buy 2 Get 1 Free",
  "description": "Special deal",
  "deal_type": "buy_x_get_y",
  "buy_quantity": 2,
  "get_quantity": 1,
  "is_active": true
}
```

---

### Packaging Rules

#### `GET /api/admin/packaging-rules`
Get all packaging rules.

**Response:**
```json
{
  "ok": true,
  "rules": [
    {
      "id": "uuid",
      "name": "Standard Package",
      "is_default": true,
      "card_count_min": 1,
      "card_count_max": 10,
      "items": [...]
    }
  ]
}
```

---

#### `POST /api/admin/packaging-rules`
Create a packaging rule.

**Request Body:**
```json
{
  "name": "Standard Package",
  "is_default": true,
  "card_count_min": 1,
  "card_count_max": 10,
  "items": [
    {
      "consumable_id": "uuid",
      "quantity": 1
    }
  ]
}
```

---

### Catalog

#### `GET /api/catalog/sets`
Get all card sets.

**Query Parameters:**
- `locale` (string, optional): Locale for translations (default: "en")
- `simplified` (boolean, optional): Return simplified format

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Base Set",
      "series": { ... },
      ...
    }
  ]
}
```

---

#### `GET /api/catalog/cards`
Get cards for a set.

**Query Parameters:**
- `setId` (string, required): Set ID
- `locale` (string, optional): Locale for translations (default: "en")

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Pikachu",
      "number": "25",
      "rarity": "Common",
      ...
    }
  ]
}
```

---

### Photos

#### `POST /api/photos/sign-url`
Get a signed URL for photo upload.

**Request Body:**
```json
{
  "path": "lot_photos/lot-id/photo.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "ok": true,
  "signedUrl": "https://...",
  "path": "lot_photos/lot-id/photo.jpg"
}
```

---

## Error Codes

Common error codes:

- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Internal server error

## Rate Limiting

API endpoints may be rate-limited in production. Check response headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## Response Times

All API routes are monitored for response times:
- Response time is included in `X-Response-Time` header
- Slow requests (>1s) are logged
- Very slow requests (>3s) trigger alerts

