export type SortOrder = "asc" | "desc";

export interface SortState<TField extends string = string> {
  readonly field: TField;
  readonly order: SortOrder;
}

export function toSortParam<TField extends string>(
  sort: SortState<TField>
): string {
  return sort.order === "desc" ? `-${sort.field}` : sort.field;
}

export function toggleSort<TField extends string>(
  current: SortState<TField>,
  field: TField
): SortState<TField> {
  return {
    field,
    order:
      current.field === field
        ? current.order === "asc"
          ? "desc"
          : "asc"
        : "asc",
  };
}
