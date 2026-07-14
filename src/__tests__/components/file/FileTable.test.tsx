import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http,HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
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
  installJsdomMockServer();

  function getNameSortButton(): HTMLElement {
    return screen.getByRole("button", { name: "Name" });
  }

  afterEach(() => {
    jest.restoreAllMocks();
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
