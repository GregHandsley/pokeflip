export function poundsToPence(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = Number(cleaned || "0");
  return Math.round(num * 100);
}

export function penceToPounds(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100).toFixed(2);
}

