import prettyBytes from "pretty-bytes";

export function toDisplayValue(value?: string): string {
  return value == null || value.trim().length === 0 ? "N/A" : value;
}

export function toFileSizeDisplay(size?: number): string | undefined {
  if (size == null) return undefined;

  return prettyBytes(size);
}
