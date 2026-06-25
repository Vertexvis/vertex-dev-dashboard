import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SWRConfig } from "swr";

import FileTable from "../../../components/file/FileTable";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const page = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "file",
      id: "file-1",
      attributes: {
        created: "2026-06-10T15:30:00Z",
        name: "alpha.jt",
        status: "completed",
        suppliedId: "supplied-1",
        uploaded: "2026-06-10T15:45:00Z",
      },
    },
  ],
  status: 200,
};

describe("FileTable", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads files sorted by created descending by default", async () => {
    const fetchMock = mockFetch(() => page);

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/files?pageSize=25&sort=-created");
  });

  it("sorts by name and toggles direction", async () => {
    const fetchMock = mockFetch(() => page);

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/files?pageSize=25&sort=name");
    });

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/files?pageSize=25&sort=-name");
    });
  });
});

function renderTable(): void {
  render(
    <SWRConfig
      value={{
        dedupingInterval: 0,
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        provider: () => new Map(),
      }}
    >
      <FileTable onFileSelected={jest.fn()} />
    </SWRConfig>
  );
}

function mockFetch(responseFor: (url: string) => unknown): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL) =>
    Promise.resolve({
      json: () => Promise.resolve(responseFor(input.toString())),
      ok: true,
    })
  );

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
