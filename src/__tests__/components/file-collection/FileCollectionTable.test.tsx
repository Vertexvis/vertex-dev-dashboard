import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import {
  fileCollection,
  fileCollectionsPage,
} from "../../../../test/msw/handlers/file-collections";
import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import FileCollectionTable from "../../../components/file-collection/FileCollectionTable";

const firstPage = fileCollectionsPage({
  data: [
    fileCollection({
      id: "collection-1",
      name: "Collection One",
      suppliedId: "supplied-1",
    }),
  ],
});

const firstPageWithNextCursor = fileCollectionsPage({
  cursors: { self: "page-1", next: "page-2" },
  data: firstPage.data,
});

const nextPage = fileCollectionsPage({
  cursors: { self: "page-2" },
  data: [
    fileCollection({
      created: "2026-06-11T15:30:00Z",
      id: "collection-2",
      name: "Collection Two",
      suppliedId: "supplied-2",
    }),
  ],
});

const multiCollectionPage = fileCollectionsPage({
  data: [
    fileCollection({
      id: "collection-1",
      name: "Collection One",
      suppliedId: "supplied-1",
    }),
    fileCollection({
      created: "2026-06-11T15:30:00Z",
      id: "collection-2",
      name: "Collection Two",
      suppliedId: "supplied-2",
    }),
  ],
});

const emptyCollectionPage = fileCollectionsPage({ data: [] });

describe("FileCollectionTable", () => {
  installJsdomMockServer();

  it("paginates file collections using the next cursor", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.get("cursor") === "page-2"
            ? nextPage
            : firstPageWithNextCursor
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return (
          params.get("cursor") === "page-2" && params.get("pageSize") === "25"
        );
      })
    ).toBe(true);
  });

  it("keeps the default API sort when no sort control is selected", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(firstPage);
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return params.get("pageSize") === "25" && !params.has("sort");
      })
    ).toBe(true);
  });

  it("sorts by name and toggles the sort direction", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        return HttpResponse.json(
          url.searchParams.get("sort") === "name" ? nextPage : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(
      requests.some(
        (search) => new URLSearchParams(search).get("sort") === "name"
      )
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    expect(
      requests.some(
        (search) => new URLSearchParams(search).get("sort") === "-name"
      )
    ).toBe(true);
  });

  it("resets cursor pagination when the sort changes", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        return HttpResponse.json(
          url.searchParams.get("cursor") === "page-2"
            ? nextPage
            : firstPageWithNextCursor
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Go to next page"));
    expect(await screen.findByText("Collection Two")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Created At" }));

    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return params.get("sort") === "created" && !params.has("cursor");
      })
    ).toBe(true);
  });

  it("clears the selection after deleting a file collection successfully", async () => {
    const deletedIds: string[][] = [];

    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(firstPage);
      }),
      http.delete("*/api/file-collections", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);

        return HttpResponse.json({ status: 200 });
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Collection One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    await waitFor(() => {
      expect(deletedIds).toEqual([["collection-1"]]);
    });
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).not.toBeChecked();
    expect(
      screen.queryByText("Could not delete collection-1.")
    ).not.toBeInTheDocument();
  });

  it("filters file collections by supplied ID before rendering the filtered results", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.get("suppliedId") === "supplied-2"
            ? nextPage
            : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Supplied ID"), "supplied-2");

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return (
          params.get("pageSize") === "25" &&
          params.get("suppliedId") === "supplied-2"
        );
      })
    ).toBe(true);
  });

  it("selects and clears all file collections on the current page", async () => {
    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(multiCollectionPage);
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    expect(screen.getByText("Collection Two")).toBeInTheDocument();

    const selectAll = screen.getAllByRole("checkbox")[0];

    await userEvent.click(selectAll);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).toBeChecked();
    expect(screen.getByLabelText("Select Collection Two")).toBeChecked();

    await userEvent.click(selectAll);

    expect(screen.getByText("File Collections")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).not.toBeChecked();
    expect(screen.getByLabelText("Select Collection Two")).not.toBeChecked();
  });

  it("keeps the selection visible when deleting a file collection fails", async () => {
    const deletedIds: string[][] = [];

    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(firstPage);
      }),
      http.delete("*/api/file-collections", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);

        return HttpResponse.json(
          { message: "Could not delete collection-1." },
          { status: 500 }
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Collection One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    expect(
      await screen.findByText("Could not delete collection-1.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).toBeChecked();
    expect(deletedIds).toEqual([["collection-1"]]);
  });

  it("filters file collections by a partial supplied ID", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.get("suppliedId") === "LIED-2" ? nextPage : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Supplied ID"), "LIED-2");

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();

    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return (
          params.get("pageSize") === "25" &&
          params.get("suppliedId") === "LIED-2"
        );
      })
    ).toBe(true);
  });

  it("sends name and supplied ID filters together", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.get("name") === "Collection" &&
            url.searchParams.get("suppliedId") === "2"
            ? nextPage
            : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Collection");
    await userEvent.type(screen.getByLabelText("Supplied ID"), "2");

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return (
          params.get("pageSize") === "25" &&
          params.get("name") === "Collection" &&
          params.get("suppliedId") === "2"
        );
      })
    ).toBe(true);
  });

  it("renders an empty filtered result", async () => {
    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);

        return HttpResponse.json(
          url.searchParams.get("name") === "missing"
            ? emptyCollectionPage
            : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "missing");

    expect(
      await screen.findByText("No file collections found.")
    ).toBeInTheDocument();
  });

  it("filters file collections by an inclusive created date range", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/file-collections", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.has("createdAtStart") &&
            url.searchParams.has("createdAtEnd")
            ? nextPage
            : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Created From"), {
      target: { value: "2026-06-11" },
    });
    fireEvent.change(screen.getByLabelText("Created To"), {
      target: { value: "2026-06-11" },
    });

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
    expect(
      requests.some((search) => {
        const params = new URLSearchParams(search);
        return params.has("createdAtStart") && params.has("createdAtEnd");
      })
    ).toBe(true);
  });

  it("renders empty created date filters initially", async () => {
    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(firstPage);
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    expect(screen.getByLabelText("Created From")).toHaveValue("");
    expect(screen.getByLabelText("Created To")).toHaveValue("");
    expect(screen.getByLabelText("Created From")).toHaveClass("emptyDateInput");
    expect(screen.getByLabelText("Created To")).toHaveClass("emptyDateInput");
  });

  it("clears the opposing created date when the range becomes invalid", async () => {
    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(firstPage);
      })
    );

    renderTable();

    const createdFrom = await screen.findByLabelText("Created From");
    const createdTo = screen.getByLabelText("Created To");
    fireEvent.change(createdFrom, { target: { value: "2026-06-11" } });
    fireEvent.change(createdTo, { target: { value: "2026-06-10" } });

    expect(createdFrom).toHaveValue("");
    expect(createdTo).toHaveValue("2026-06-10");
  });

  it("renders an empty sorted result", async () => {
    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(
          fileCollectionsPage({ cursors: { self: "page-1" }, data: [] })
        );
      })
    );

    renderTable();

    await userEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(
      await screen.findByText("No file collections found.")
    ).toBeInTheDocument();
  });

  it("renders the existing file collection detail route as an href", async () => {
    server.use(
      http.get("*/api/file-collections", () => {
        return HttpResponse.json(firstPage);
      })
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    expect(screen.getByLabelText("Open Collection One")).toHaveAttribute(
      "href",
      "/file-collections/collection-1"
    );
  });
});

function renderTable(): void {
  renderWithSWR(<FileCollectionTable />);
}
