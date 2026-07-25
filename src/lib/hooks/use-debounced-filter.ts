import debounce from "lodash.debounce";
import React from "react";

export type SetOptionalString = React.Dispatch<
  React.SetStateAction<string | undefined>
>;

/**
 * Debounces a filter text field: 300ms after the last keystroke, resets
 * paging and stores the value (empty as undefined). Pending invocations are
 * cancelled on unmount so a trailing update cannot fire into an unmounted
 * table.
 */
export function useDebouncedFilter(
  setFilter: SetOptionalString,
  resetPaging: () => void
): (value: string) => void {
  const debounced = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setFilter(value === "" ? undefined : value);
      }, 300),
    [resetPaging, setFilter]
  );

  React.useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}
