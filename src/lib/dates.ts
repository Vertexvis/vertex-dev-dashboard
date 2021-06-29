const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
