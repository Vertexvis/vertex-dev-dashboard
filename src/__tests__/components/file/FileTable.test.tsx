import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import FileTable from "../../../components/file/FileTable";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  isReady: true,
  pathname: "/files",
  push: mockPush,
  query: {} as Record<string, string | string[] | undefined>,
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
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
  installJsdomMockServer();

  function getNameSortButton(): HTMLElement {
    return screen.getByRole("button", { name: "Name" });
  }

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockRouter.query = {};
  });

  it("loads files sorted by created descending by default", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/files", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(requests).toContain(
      "http://localhost/api/files?pageSize=25&sort=-created"
    );
  });

  it("renders an available file as a dedicated download href", async () => {
    server.use(
      http.get("*/api/files", () => {
        return HttpResponse.json(page);
      })
    );

    renderTable();

    expect(await screen.findByLabelText("Download alpha.jt")).toHaveAttribute(
      "href",
      "/api/files/file-1/download"
    );
  });

  it("sorts by name and toggles direction", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/files", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
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
    let resolveSortedPage: (() => void) | undefined;
    const sortedPageLoaded = new Promise<void>((resolve) => {
      resolveSortedPage = resolve;
    });

    server.use(
      http.get("*/api/files", async ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get("sort") === "name") {
          await sortedPageLoaded;
        }

        return HttpResponse.json(
          url.searchParams.get("sort") === "name" ? page : pagedPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toBeEnabled();

    await userEvent.click(getNameSortButton());

    expect(screen.getByLabelText("Go to next page")).toBeDisabled();

    resolveSortedPage?.();
    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
  });

  it("loads filters, sort, and cursor paging from the URL", async () => {
    const requests: string[] = [];
    mockRouter.query = {
      fileCursor: "cursor-2",
      fileFilterId: "file-filter",
      fileName: "alpha",
      filePage: "2",
      filePreviousCursors: JSON.stringify({ 0: "page-1", 1: "page-2" }),
      fileSort: "name",
      fileSuppliedId: "supplied-1",
    };

    server.use(
      http.get("*/api/files", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("alpha");
    expect(screen.getByLabelText("File ID")).toHaveValue("file-filter");
    expect(screen.getByLabelText("Supplied ID")).toHaveValue("supplied-1");
    const request = new URL(requests[0]);
    expect(request.searchParams.get("pageSize")).toBe("25");
    expect(request.searchParams.get("cursor")).toBe("cursor-2");
    expect(request.searchParams.get("sort")).toBe("name");
    expect(request.searchParams.get("fileId")).toBe("file-filter");
    expect(request.searchParams.get("name")).toBe("alpha");
    expect(request.searchParams.get("suppliedId")).toBe("supplied-1");
  });

  it("stores cursor paging state in the URL when the page changes", async () => {
    server.use(
      http.get("*/api/files", ({ request }) =>
        HttpResponse.json(
          request.url.includes("cursor=page-2") ? page : pagedPage
        )
      )
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        {
          pathname: "/files",
          query: {
            fileCursor: "page-2",
            filePage: "1",
            filePreviousCursors: JSON.stringify({ 0: "page-1" }),
          },
        },
        undefined,
        {
          scroll: false,
          shallow: true,
        }
      );
    });
  });

  it("preserves the selected local created dates in the inline filters", async () => {
    server.use(
      http.get("*/api/files", () => {
        return HttpResponse.json(page);
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
    expect(fromInput).not.toHaveClass("emptyDateInput");
    expect(toInput).not.toHaveClass("emptyDateInput");
  });

  it("renders empty created date filters initially", async () => {
    server.use(
      http.get("*/api/files", () => {
        return HttpResponse.json(page);
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    expect(screen.getByLabelText("Created From")).toHaveValue("");
    expect(screen.getByLabelText("Created To")).toHaveValue("");
    expect(screen.getByLabelText("Created From")).toHaveClass("emptyDateInput");
    expect(screen.getByLabelText("Created To")).toHaveClass("emptyDateInput");
  });

  it("clears the conflicting created to date when created from moves past it", async () => {
    server.use(
      http.get("*/api/files", () => {
        return HttpResponse.json(page);
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
  renderWithSWR(<FileTable onFileSelected={onFileSelected} {...props} />);
}
