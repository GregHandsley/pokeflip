/**
 * Edge-compatible CSV generation utility
 * Replaces json2csv which requires Node.js stream module
 */

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string
 * @param data Array of objects with the same keys
 * @returns CSV string with headers and rows
 */
export function toCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) {
    return "";
  }

  // Get all unique keys from all rows to create header
  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));

  // Build CSV string
  const csv = [
    // Header row
    headers.map(escapeCSV).join(","),
    // Data rows
    ...data.map((row) => headers.map((header) => escapeCSV(row[header])).join(",")),
  ].join("\n");

  return csv;
}
