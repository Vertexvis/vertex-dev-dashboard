import { render } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";

export function renderWithSWR(ui: React.ReactElement) {
  function wrap(children: React.ReactElement): React.ReactElement {
    return (
      <SWRConfig
        value={{
          dedupingInterval: 0,
          fetcher: (url: string) =>
            fetch(new URL(url, window.location.origin).toString()).then((res) =>
              res.json()
            ),
          provider: () => new Map(),
        }}
      >
        {children}
      </SWRConfig>
    );
  }

  const result = render(wrap(ui));

  return {
    ...result,
    rerender(nextUi: React.ReactElement) {
      result.rerender(wrap(nextUi));
    },
  };
}
