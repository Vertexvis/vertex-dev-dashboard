const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"] as const;
const BYTES_PER_UNIT = 1024;

export function toDisplayValue(value?: string): string {
  return value == null || value.trim().length === 0 ? "N/A" : value;
}

export function toFileSizeDisplay(size?: number): string | undefined {
  if (size == null) return undefined;

  if (size === 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(BYTES_PER_UNIT)),
    BYTE_UNITS.length - 1
  );
  const value = size / BYTES_PER_UNIT ** exponent;
  const minimumSignificantDigits = Math.max(
    3,
    Math.trunc(value).toString().length
  );

  return `${Number(value.toPrecision(minimumSignificantDigits))} ${
    BYTE_UNITS[exponent]
  }`;
}
