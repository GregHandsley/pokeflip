/**
 * Client-side sanitization utilities
 * Lightweight sanitization for use in React components
 * For server-side sanitization, use @/lib/sanitization
 */

/**
 * Sanitizes a string input to prevent XSS (client-side version)
 * This is a simpler version for client-side use
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "");

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // Remove potentially dangerous patterns
  sanitized = sanitized
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/<script/gi, "")
    .replace(/<\/script>/gi, "")
    .replace(/<iframe/gi, "")
    .replace(/<object/gi, "")
    .replace(/<embed/gi, "");

  return sanitized.trim();
}

/**
 * Sanitizes a filename for safe client-side use
 */
export function sanitizeFilenameClient(filename: string): string {
  if (typeof filename !== "string") {
    return "file";
  }

  return filename
    .replace(/[\/\\]/g, "") // Remove path separators
    .replace(/\0/g, "") // Remove null bytes
    .replace(/\.\./g, "") // Remove parent directory references
    .replace(/^\.+/, "") // Remove leading dots
    .trim() || "file";
}

