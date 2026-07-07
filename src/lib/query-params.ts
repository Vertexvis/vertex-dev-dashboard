export function parsePositiveQueryInt(
  value: string | undefined,
  defaultValue: number
): number {
  const trimmed = value?.trim();
  if (trimmed == null || !/^\d+$/.test(trimmed)) return defaultValue;

  const parsed = Number.parseInt(trimmed, 10);
  return parsed > 0 ? parsed : defaultValue;
}
