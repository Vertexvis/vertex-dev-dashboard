const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type DayBoundary = "start" | "end";

// https://stackoverflow.com/questions/3224834/get-difference-between-2-dates-in-javascript
export function dateDiffInDays(a: Date, b: Date = new Date()): number {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

export function toLocaleString(date?: string, fallback = ""): string {
  return date ? new Date(date).toLocaleString() : fallback;
}

/**
 * Converts a date input value to the inclusive start or end of that local day.
 */
export function toLocalDayBoundaryIso(
  value: string,
  boundary: DayBoundary
): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return date.toISOString();
}

/**
 * Converts an ISO timestamp to the corresponding local date input value.
 */
export function toLocalDateInputValue(value?: string): string {
  if (value == null) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
