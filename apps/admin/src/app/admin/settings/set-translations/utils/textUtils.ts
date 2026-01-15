// Helper function to convert text to title case
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      // Handle special cases like "ex", "v", "vmax", etc.
      if (word === "ex" || word === "v" || word === "vmax" || word === "vstar" || word === "gx") {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
