import { FilterExpression } from "@vertexvis/api-client-node";

type FilterOperation = keyof FilterExpression;

const FilterOperations: FilterOperation[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
];

export function setFilterExpression(
  params: URLSearchParams,
  field: string,
  filter?: FilterExpression
): void {
  if (filter == null) return;

  FilterOperations.forEach((operation) => {
    const value = filter[operation];
    if (value != null) {
      params.append(`filter[${field}][${operation}]`, value);
    }
  });
}
