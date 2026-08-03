import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { NuqsTestingAdapter, UrlUpdateEvent } from "nuqs/adapters/testing";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import NuqsFileTable from "../../../components/file/NuqsFileTable";

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

describe("NuqsFileTable", () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads transferable table state from the URL", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/files", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
      })
    );

    renderTable({
      searchParams:
        "?fileName=alpha&fileFilterId=file-filter&fileSuppliedId=supplied-1" +
        "&fileCreatedAtStart=2026-06-01&fileCreatedAtEnd=2026-06-30" +
        "&fileCursor=cursor-2&filePage=2&fileSort=name",
    });

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("alpha");
    expect(screen.getByLabelText("File ID")).toHaveValue("file-filter");
    expect(screen.getByLabelText("Supplied ID")).toHaveValue("supplied-1");
    expect(screen.getByLabelText("Created From")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("Created To")).toHaveValue("2026-06-30");
    expect(screen.getByLabelText("Go to previous page")).toBeDisabled();

    const request = new URL(requests[0]);
    expect(request.searchParams.get("cursor")).toBe("cursor-2");
    expect(request.searchParams.get("fileId")).toBe("file-filter");
    expect(request.searchParams.get("name")).toBe("alpha");
    expect(request.searchParams.get("sort")).toBe("name");
    expect(request.searchParams.get("suppliedId")).toBe("supplied-1");
    expect(request.searchParams.has("createdAtStart")).toBe(true);
    expect(request.searchParams.has("createdAtEnd")).toBe(true);
  });

  it("updates a filter and resets paging as one URL update", async () => {
    const events: UrlUpdateEvent[] = [];

    server.use(http.get("*/api/files", () => HttpResponse.json(page)));

    renderTable({
      onUrlUpdate: (event) => events.push(event),
      searchParams: "?fileCursor=cursor-2&filePage=2",
    });

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "alpha");

    await waitFor(() => {
      const last = events[events.length - 1];
      expect(last?.searchParams.get("fileName")).toBe("alpha");
    });

    const last = events[events.length - 1];
    expect(last.options.history).toBe("replace");
    expect(last.searchParams.has("fileCursor")).toBe(false);
    expect(last.searchParams.has("filePage")).toBe(false);
    expect(screen.getByLabelText("Name")).toHaveValue("alpha");
  });

  it("moves forward with the API cursor using push history", async () => {
    const events: UrlUpdateEvent[] = [];

    server.use(http.get("*/api/files", () => HttpResponse.json(pagedPage)));

    renderTable({ onUrlUpdate: (event) => events.push(event) });

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Go to next page"));

    await waitFor(() => expect(events.length).toBe(1));
    expect(events[0].options.history).toBe("push");
    expect(events[0].searchParams.get("fileCursor")).toBe("page-2");
    expect(events[0].searchParams.get("filePage")).toBe("1");
  });
});

function renderTable({
  onUrlUpdate,
  searchParams,
}: {
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
  searchParams?: string;
} = {}): void {
  renderWithSWR(
    <NuqsTestingAdapter
      hasMemory={true}
      onUrlUpdate={onUrlUpdate}
      searchParams={searchParams}
    >
      <NuqsFileTable onFileSelected={jest.fn()} />
    </NuqsTestingAdapter>
  );
}
