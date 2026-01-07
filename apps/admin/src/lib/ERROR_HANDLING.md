# Error Handling & Logging Guide

This document describes the error handling and logging system implemented in the application.

## Overview

The application now has:
1. **Structured Logging** - Centralized logging with context
2. **Toast Notifications** - User-friendly error messages
3. **Error Boundaries** - React error catching
4. **API Error Handling** - Consistent error responses

## Structured Logging

### Server-Side (API Routes)

```typescript
import { createApiLogger } from "@/lib/logger";

export async function POST(req: Request) {
  const logger = createApiLogger(req);
  
  try {
    // Your code here
    logger.info("Operation successful", undefined, { metadata });
  } catch (error) {
    logger.error("Operation failed", error, undefined, { metadata });
  }
}
```

### Client-Side

```typescript
import { logger } from "@/lib/logger";

logger.info("User action", { userId: "123" });
logger.error("Something went wrong", error, { path: window.location.pathname });
```

### Log Levels

- `debug` - Only in development
- `info` - Informational messages
- `warn` - Warnings (non-critical errors)
- `error` - Errors that need attention

## Toast Notifications

### Using the Toast Hook

```typescript
import { useToast } from "@/contexts/ToastContext";

function MyComponent() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  
  const handleAction = async () => {
    try {
      await doSomething();
      showSuccess("Operation completed successfully");
    } catch (error) {
      showError("Failed to complete operation");
    }
  };
}
```

### Toast Types

- `success` - Green toast for successful operations
- `error` - Red toast for errors
- `info` - Blue toast for informational messages
- `warning` - Yellow toast for warnings

## Error Boundaries

Error boundaries are already set up in `apps/admin/src/app/admin/layout.tsx`. They will:
- Catch React component errors
- Display a user-friendly error page
- Log errors with full context
- Allow users to reload or try again

## API Error Handling

### Server-Side Error Responses

```typescript
import { createErrorResponse, handleApiError } from "@/lib/api-error-handler";

// For validation errors
return createErrorResponse("Invalid input", 400, "VALIDATION_ERROR");

// In catch blocks
} catch (error) {
  return handleApiError(req, error, {
    operation: "create_sale",
    metadata: { body },
  });
}
```

### Client-Side Error Handling

```typescript
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";

function MyComponent() {
  const { handleError, withErrorHandling } = useApiErrorHandler();
  
  // Option 1: Manual handling
  try {
    await fetch("/api/endpoint");
  } catch (error) {
    handleError(error, { operation: "fetch_data" });
  }
  
  // Option 2: Automatic handling
  const safeFetch = withErrorHandling(
    async () => {
      const res = await fetch("/api/endpoint");
      return res.json();
    },
    { operation: "fetch_data" }
  );
  
  const result = await safeFetch();
  if (result) {
    // Use result
  }
}
```

## Migration Guide

### Replacing console.error

**Before:**
```typescript
try {
  // code
} catch (error) {
  console.error("Error:", error);
}
```

**After:**
```typescript
import { logger } from "@/lib/logger";

try {
  // code
} catch (error) {
  logger.error("Operation failed", error, { context });
}
```

### Replacing Error Modals

**Before:**
```typescript
const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

// Show error
setErrorModal({ isOpen: true, message: "Error occurred" });
```

**After:**
```typescript
import { useToast } from "@/contexts/ToastContext";

const { showError } = useToast();

// Show error
showError("Error occurred");
```

## Future Enhancements

- [ ] Integrate with Sentry for production error tracking
- [ ] Add error analytics dashboard
- [ ] Implement retry logic for transient errors
- [ ] Add error reporting to admin dashboard

