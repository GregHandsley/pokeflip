/**
 * Input sanitization utilities to prevent XSS attacks
 * Sanitizes user input before storing or displaying
 */

/**
 * Sanitizes a string by removing/escaping potentially dangerous HTML/JavaScript
 * This is a basic implementation - for production, consider using DOMPurify
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Escape HTML entities
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  sanitized = sanitized.replace(/[&<>"'/]/g, (match) => escapeMap[match]);

  // Remove potentially dangerous script patterns
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+=/gi, ""); // Remove event handlers like onclick=
  sanitized = sanitized.replace(/<script/gi, "");
  sanitized = sanitized.replace(/<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe/gi, "");
  sanitized = sanitized.replace(/<object/gi, "");
  sanitized = sanitized.replace(/<embed/gi, "");

  return sanitized.trim();
}

/**
 * Sanitizes text input for display (more permissive than storage)
 * Allows some HTML but sanitizes dangerous content
 */
export function sanitizeForDisplay(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Remove script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/vbscript:/gi, "");
  sanitized = sanitized.replace(/data:/gi, "");

  return sanitized.trim();
}

/**
 * Sanitizes a filename to prevent directory traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== "string") {
    return "file";
  }

  // Remove path separators and null bytes
  let sanitized = filename
    .replace(/[\/\\]/g, "") // Remove path separators
    .replace(/\0/g, "") // Remove null bytes
    .replace(/\.\./g, "") // Remove parent directory references
    .trim();

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, "");

  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = "file";
  }

  // Limit length (255 is typical max filename length)
  if (sanitized.length > 255) {
    const ext = sanitized.split(".").pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf("."));
    sanitized = nameWithoutExt.substring(0, 250 - (ext?.length || 0)) + "." + ext;
  }

  return sanitized;
}

/**
 * Validates and sanitizes a URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== "string" || !url.trim()) {
    return null;
  }

  let sanitized = url.trim();

  // Remove dangerous protocols
  const dangerousProtocols = ["javascript:", "vbscript:", "data:", "file:"];
  for (const protocol of dangerousProtocols) {
    if (sanitized.toLowerCase().startsWith(protocol)) {
      return null;
    }
  }

  // Only allow http, https, and relative URLs
  if (!sanitized.match(/^(https?:\/\/|\/)/i) && !sanitized.startsWith("#")) {
    return null;
  }

  return sanitized;
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  const sanitized = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }

  // Additional checks for dangerous characters
  if (sanitized.includes("<") || sanitized.includes(">") || sanitized.includes("\n")) {
    return null;
  }

  return sanitized;
}

