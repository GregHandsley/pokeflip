/**
 * Shared formatting utilities to avoid code duplication
 */

/**
 * Format a date string to a user-friendly relative time or absolute date
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "5 minutes ago", "2 hours ago", or "10 Jan 2024, 14:30")
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    // For older dates, show the actual date
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * Format a date string to a standard locale string
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "1/10/2026, 10:58:24 PM")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Format a date string to a date-only format
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "10 Jan 2026")
 */
export function formatDateOnly(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format price in pence to pounds
 * @param pence Price in pence
 * @returns Formatted price string (e.g., "£1.25")
 */
export function formatPrice(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) {
    return "£0.00";
  }
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Format execution time (milliseconds to human-readable)
 * @param ms Time in milliseconds
 * @returns Formatted time string (e.g., "250ms" or "1.50s")
 */
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format entity type to user-friendly label
 * @param entityType Entity type string (e.g., "sales_order", "inventory_lot")
 * @returns User-friendly label (e.g., "Sales Order", "Inventory Lot")
 */
export function formatEntityType(entityType: string): string {
  const types: Record<string, string> = {
    sales_order: "Sales Order",
    sales_item: "Sales Item",
    inventory_lot: "Inventory Lot",
    bundle: "Bundle",
    bundle_item: "Bundle Item",
    acquisition: "Purchase",
    intake_line: "Purchase Item",
    sales_item_purchase_allocation: "Purchase Allocation",
    lot_photo: "Lot Photo",
    ebay_listing: "eBay Listing",
    system: "System",
  };
  return (
    types[entityType] || entityType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

/**
 * Format status to user-friendly label
 * @param status Status string (e.g., "draft", "listed", "sold")
 * @returns User-friendly label (e.g., "Draft", "Listed", "Sold")
 */
export function formatStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    listed: "Listed",
    sold: "Sold",
    archived: "Archived",
    open: "Open",
    closed: "Closed",
  };
  return statusLabels[status] || status;
}
