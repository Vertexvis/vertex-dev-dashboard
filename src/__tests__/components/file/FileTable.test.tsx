import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import nodeFetch, { Headers, Request, Response } from "node-fetch";
import React from "react";
import { SWRConfig } from "swr";

import { server } from "../../../../test/msw/server";
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
        status: "complete",
        suppliedId: "supplied-1",
        uploaded: "2026-06-10T15:45:00Z",
      },
    },
  ],
  status: 200,
};

const pagedPage = {
  cursors: { self: "page-1", next: "page-2" },
  data: page.data,
  status: 200,
};

describe("FileTable", () => {
  function getNameSortButton(): HTMLElement {
    return screen.getByRole("button", { name: "Name" });
  }

  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch: nodeFetch,
    });
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    jest.restoreAllMocks();
    Object.assign(global, { fetch: nodeFetch });
  });

  afterAll(() => {
    server.close();
  });

  it("loads files sorted by created descending by default", async () => {
    const requests: string[] = [];

    server.use(
      rest.get("*/api/files", (req, res, ctx) => {
        requests.push(req.url.toString());
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(requests).toContain(
      "http://localhost/api/files?pageSize=25&sort=-created"
    );
  });

  it("sorts by name and toggles direction", async () => {
    const requests: string[] = [];

    server.use(
      rest.get("*/api/files", (req, res, ctx) => {
        requests.push(req.url.toString());
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    await userEvent.click(getNameSortButton());
    await waitFor(() => {
      expect(requests).toContain(
        "http://localhost/api/files?pageSize=25&sort=name"
      );
    });

    await userEvent.click(getNameSortButton());
    await waitFor(() => {
      expect(requests).toContain(
        "http://localhost/api/files?pageSize=25&sort=-name"
      );
    });
  });

  it("disables pagination while a sorted request is loading", async () => {
    let resolveSortedPage: ((value: unknown) => void) | undefined;
    const sortedPage = new Promise((resolve) => {
      resolveSortedPage = resolve;
    });
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = input.toString();

      return Promise.resolve({
        json: () =>
          url.includes("sort=name") ? sortedPage : Promise.resolve(pagedPage),
        ok: true,
      });
    });
    global.fetch = fetchMock as unknown as typeof nodeFetch;

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toBeEnabled();

    await userEvent.click(getNameSortButton());

    expect(screen.getByLabelText("Go to next page")).toBeDisabled();

    resolveSortedPage?.(page);
    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
  });

  it("preserves the selected local created dates in the inline filters", async () => {
    server.use(
      rest.get("*/api/files", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    const fromInput = screen.getByLabelText("Created From");
    const toInput = screen.getByLabelText("Created To");

    await userEvent.type(fromInput, "2026-06-01");
    await userEvent.type(toInput, "2026-06-30");

    expect(fromInput).toHaveValue("2026-06-01");
    expect(toInput).toHaveValue("2026-06-30");
  });

  it("clears the conflicting created to date when created from moves past it", async () => {
    server.use(
      rest.get("*/api/files", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    const fromInput = screen.getByLabelText("Created From");
    const toInput = screen.getByLabelText("Created To");

    await userEvent.type(fromInput, "2026-06-01");
    await userEvent.type(toInput, "2026-06-30");
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, "2026-07-01");

    expect(fromInput).toHaveValue("2026-07-01");
    expect(toInput).toHaveValue("");
  });
});

function renderTable(
  onFileSelected = jest.fn(),
  props: Partial<React.ComponentProps<typeof FileTable>> = {}
): void {
  render(
    <SWRConfig
      value={{
        dedupingInterval: 0,
        fetcher: (url: string) =>
          (global.fetch as typeof nodeFetch)(
            new URL(url, window.location.origin).toString()
          ).then((res) => res.json()),
        provider: () => new Map(),
      }}
    >
      <FileTable onFileSelected={onFileSelected} {...props} />
    </SWRConfig>
  );
}
