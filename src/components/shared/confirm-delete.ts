export function confirmResourceDeletion(
  count: number,
  resourceName: string
): boolean {
  const name = count === 1 ? resourceName : `${resourceName}s`;
  return window.confirm(
    `Delete ${count} selected ${name}? This cannot be undone.`
  );
}
