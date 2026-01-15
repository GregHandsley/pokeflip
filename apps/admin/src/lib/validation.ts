/**
 * Server-side validation utilities
 * Provides type-safe validation for API endpoints
 */

import { sanitizeString, sanitizeForDisplay } from "./sanitization";

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export class ValidationErrorResponse extends Error {
  constructor(
    public errors: ValidationError[],
    public statusCode: number = 400
  ) {
    super("Validation failed");
    this.name = "ValidationErrorResponse";
  }
}

/**
 * Validates that a value is not null or undefined
 */
export function required<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} is required`, code: "REQUIRED" },
    ]);
  }
  return value;
}

/**
 * Validates that a value is a string
 */
export function string(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be a string`, code: "INVALID_TYPE" },
    ]);
  }
  return value;
}

/**
 * Validates that a value is a non-empty string
 */
export function nonEmptyString(value: unknown, fieldName: string): string {
  const str = string(value, fieldName);
  if (str.trim().length === 0) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} cannot be empty`, code: "EMPTY_STRING" },
    ]);
  }
  return str;
}

/**
 * Validates and sanitizes a string value to prevent XSS
 * Use this for user-provided text that will be stored
 */
export function sanitizedString(value: unknown, fieldName: string): string {
  const str = string(value, fieldName);
  return sanitizeString(str);
}

/**
 * Validates and sanitizes a non-empty string value to prevent XSS
 * Use this for required user-provided text that will be stored
 */
export function sanitizedNonEmptyString(value: unknown, fieldName: string): string {
  const str = nonEmptyString(value, fieldName);
  return sanitizeString(str);
}

/**
 * Validates a string that may contain HTML (for display purposes)
 * Sanitizes dangerous content but allows safe HTML
 */
export function sanitizedHtmlString(value: unknown, fieldName: string): string {
  const str = string(value, fieldName);
  return sanitizeForDisplay(str);
}

/**
 * Validates that a value is a number
 */
export function number(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be a number`, code: "INVALID_TYPE" },
    ]);
  }
  return value;
}

/**
 * Validates that a value is an integer
 */
export function integer(value: unknown, fieldName: string): number {
  const num = number(value, fieldName);
  if (!Number.isInteger(num)) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be an integer`, code: "INVALID_TYPE" },
    ]);
  }
  return num;
}

/**
 * Validates that a number is greater than a minimum value
 */
export function min(value: number, minValue: number, fieldName: string): number {
  if (value < minValue) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: `${fieldName} must be at least ${minValue}`,
        code: "MIN_VALUE",
      },
    ]);
  }
  return value;
}

/**
 * Validates that a number is greater than 0
 */
export function positive(value: number, fieldName: string): number {
  return min(value, 1, fieldName);
}

/**
 * Validates that a number is greater than or equal to 0
 */
export function nonNegative(value: number, fieldName: string): number {
  return min(value, 0, fieldName);
}

/**
 * Validates that a number is less than or equal to a maximum value
 */
export function max(value: number, maxValue: number, fieldName: string): number {
  if (value > maxValue) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: `${fieldName} must be at most ${maxValue}`,
        code: "MAX_VALUE",
      },
    ]);
  }
  return value;
}

/**
 * Validates that a number is within a range
 */
export function range(
  value: number,
  minValue: number,
  maxValue: number,
  fieldName: string
): number {
  min(value, minValue, fieldName);
  max(value, maxValue, fieldName);
  return value;
}

/**
 * Validates that a value is a boolean
 */
export function boolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be a boolean`, code: "INVALID_TYPE" },
    ]);
  }
  return value;
}

/**
 * Validates that a value is a valid UUID
 */
export function uuid(value: unknown, fieldName: string): string {
  const str = string(value, fieldName);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(str)) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be a valid UUID`, code: "INVALID_UUID" },
    ]);
  }
  return str;
}

/**
 * Validates that a value is one of the allowed enum values
 */
export function enumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T {
  const str = string(value, fieldName);
  if (!allowedValues.includes(str as T)) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: `${fieldName} must be one of: ${allowedValues.join(", ")}`,
        code: "INVALID_ENUM",
      },
    ]);
  }
  return str as T;
}

/**
 * Validates that a value is an array
 */
export function array<T>(value: unknown, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be an array`, code: "INVALID_TYPE" },
    ]);
  }
  return value;
}

/**
 * Validates that an array is not empty
 */
export function nonEmptyArray<T>(value: unknown, fieldName: string): T[] {
  const arr = array<T>(value, fieldName);
  if (arr.length === 0) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} cannot be empty`, code: "EMPTY_ARRAY" },
    ]);
  }
  return arr;
}

/**
 * Validates that a value is a valid email
 */
export function email(value: unknown, fieldName: string): string {
  const str = string(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(str)) {
    throw new ValidationErrorResponse([
      { field: fieldName, message: `${fieldName} must be a valid email`, code: "INVALID_EMAIL" },
    ]);
  }
  return str;
}

/**
 * Validates that a value matches a regex pattern
 */
export function pattern(value: string, regex: RegExp, fieldName: string, message?: string): string {
  if (!regex.test(value)) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: message || `${fieldName} has invalid format`,
        code: "INVALID_PATTERN",
      },
    ]);
  }
  return value;
}

/**
 * Validates that a value has a maximum length
 */
export function maxLength(value: string, maxLen: number, fieldName: string): string {
  if (value.length > maxLen) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: `${fieldName} must be at most ${maxLen} characters`,
        code: "MAX_LENGTH",
      },
    ]);
  }
  return value;
}

/**
 * Validates that a value has a minimum length
 */
export function minLength(value: string, minLen: number, fieldName: string): string {
  if (value.length < minLen) {
    throw new ValidationErrorResponse([
      {
        field: fieldName,
        message: `${fieldName} must be at least ${minLen} characters`,
        code: "MIN_LENGTH",
      },
    ]);
  }
  return value;
}

/**
 * Validates that a value is optional (can be null/undefined) but if present, must pass validation
 */
export function optional<T>(
  value: T | null | undefined,
  validator: (val: T, fieldName: string) => T,
  fieldName: string
): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return validator(value, fieldName);
}

/**
 * Validates a price in pence (must be positive integer)
 */
export function pricePence(value: unknown, fieldName: string): number {
  const num = integer(value, fieldName);
  return positive(num, fieldName);
}

/**
 * Validates a quantity (must be positive integer)
 */
export function quantity(value: unknown, fieldName: string): number {
  const num = integer(value, fieldName);
  return positive(num, fieldName);
}

/**
 * Validates a non-negative quantity (can be 0)
 */
export function nonNegativeQuantity(value: unknown, fieldName: string): number {
  const num = integer(value, fieldName);
  return nonNegative(num, fieldName);
}

/**
 * Validates a percentage (0-100)
 */
export function percentage(value: unknown, fieldName: string): number {
  const num = number(value, fieldName);
  return range(num, 0, 100, fieldName);
}

/**
 * Validates card condition enum
 */
export const CARD_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];
export function cardCondition(value: unknown, fieldName: string): CardCondition {
  return enumValue(value, CARD_CONDITIONS, fieldName);
}

/**
 * Validates lot status enum
 */
export const LOT_STATUSES = ["draft", "ready", "listed", "sold", "archived"] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];
export function lotStatus(value: unknown, fieldName: string): LotStatus {
  return enumValue(value, LOT_STATUSES, fieldName);
}

/**
 * Validates bundle status enum
 */
export const BUNDLE_STATUSES = ["draft", "active", "sold", "archived"] as const;
export type BundleStatus = (typeof BUNDLE_STATUSES)[number];
export function bundleStatus(value: unknown, fieldName: string): BundleStatus {
  return enumValue(value, BUNDLE_STATUSES, fieldName);
}

/**
 * Validates promotional deal type enum
 */
export const DEAL_TYPES = ["percentage_off", "fixed_off", "free_shipping", "buy_x_get_y"] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export function dealType(value: unknown, fieldName: string): DealType {
  return enumValue(value, DEAL_TYPES, fieldName);
}

/**
 * Helper to convert ValidationErrorResponse to API error response format
 */
export function formatValidationError(error: ValidationErrorResponse) {
  return {
    error: "Validation failed",
    errors: error.errors,
    code: "VALIDATION_ERROR",
  };
}

/**
 * Wrapper for API route handlers to catch validation errors
 * Usage:
 *   try {
 *     const validated = validateRequest(body, schema);
 *     // ... use validated data
 *   } catch (error) {
 *     if (error instanceof ValidationErrorResponse) {
 *       return NextResponse.json(formatValidationError(error), { status: error.statusCode });
 *     }
 *     throw error;
 *   }
 */
export function handleValidationError(error: unknown): Response | null {
  if (error instanceof ValidationErrorResponse) {
    return new Response(JSON.stringify(formatValidationError(error)), {
      status: error.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
