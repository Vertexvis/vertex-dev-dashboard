import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import fetch, { Headers, Request, Response } from "node-fetch";
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
        status: "completed",
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
  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch,
    });
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    jest.restoreAllMocks();
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
    expect(requests).toContain("http://localhost/api/files?pageSize=25&sort=-created");
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

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(requests).toContain("http://localhost/api/files?pageSize=25&sort=name");
    });

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(requests).toContain("http://localhost/api/files?pageSize=25&sort=-name");
    });
  });

  it("disables pagination while a sorted request is loading", async () => {
    let resolveSortedPage: ((value: unknown) => void) | undefined;
    const sortedPage = new Promise((resolve) => {
      resolveSortedPage = resolve;
    });
    server.use(
      rest.get("*/api/files", (req, res, ctx) => {
        const sort = req.url.searchParams.get("sort");
        return sort === "name"
          ? sortedPage.then((response) => res(ctx.json(response)))
          : res(ctx.json(pagedPage));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toBeEnabled();

    await userEvent.click(screen.getByText("Name"));

    expect(screen.getByLabelText("Go to next page")).toBeDisabled();

    resolveSortedPage?.(page);
    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
  });
});

function renderTable(): void {
  render(
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
      <FileTable onFileSelected={jest.fn()} />
    </SWRConfig>
  );
}
