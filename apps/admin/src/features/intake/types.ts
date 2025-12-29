export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";

export const CONDITIONS: Condition[] = ["NM","LP","MP","HP","DMG"];

export type BinderLayout = 6 | 9 | 12;

export function layoutToGrid(layout: BinderLayout) {
  // 6 = 2x3, 9 = 3x3, 12 = 3x4
  if (layout === 6) return { cols: 3, rows: 2, perPage: 6 };
  if (layout === 9) return { cols: 3, rows: 3, perPage: 9 };
  return { cols: 4, rows: 3, perPage: 12 };
}

