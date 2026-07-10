import { render } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";

export function renderWithSWR(ui: React.ReactElement) {
  return render(
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
      {ui}
    </SWRConfig>
  );
}
