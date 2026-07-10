import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  deleteFileCollections,
  fileCollection,
  fileCollectionsPage,
  listFileCollections,
} from "../../../../test/msw/handlers/file-collections";
import { installMockServer } from "../../../../test/msw/install";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import FileCollectionTable from "../../../components/file-collection/FileCollectionTable";

const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const firstPage = fileCollectionsPage({
  data: [
    fileCollection({
      id: "collection-1",
      name: "Collection One",
      suppliedId: "supplied-1",
    }),
  ],
});

const firstPageWithUnexpectedNextCursor = fileCollectionsPage({
  cursors: { self: "page-1", next: "page+2&filter=unexpected#fragment" },
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

describe("FileCollectionTable", () => {
  installMockServer();

  beforeEach(() => {
    mockPush.mockClear();
  });

  it("paginates file collections using the next cursor", async () => {
    stubFileCollectionsTable({
      byCursor: {
        "page+2&filter=unexpected#fragment": nextPage,
      },
      defaultPage: firstPageWithUnexpectedNextCursor,
    });

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
  });

  it("filters file collections by supplied ID before rendering the filtered results", async () => {
    stubFileCollectionsTable({
      bySuppliedId: {
        "supplied-2": nextPage,
      },
      defaultPage: firstPage,
    });

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Supplied ID Filter (exact)"),
      "supplied-2"
    );

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
  });

  it("keeps the selection visible when deleting a file collection fails", async () => {
    stubFileCollectionsTable({
      defaultPage: firstPage,
      deleteOptions: {
        expectedIds: ["collection-1"],
        response: {
          body: { message: "Could not delete collection-1." },
          status: 500,
        },
      },
    });

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Collection One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    expect(
      await screen.findByText("Could not delete collection-1.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).toBeChecked();
  });

  it("navigates to the file collection detail route when a row is clicked", async () => {
    stubFileCollectionsTable({
      defaultPage: firstPage,
    });

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Collection One"));

    expect(mockPush).toHaveBeenCalledWith("/file-collections/collection-1");
  });
});

function renderTable(): void {
  renderWithSWR(<FileCollectionTable />);
}

function stubFileCollectionsTable({
  byCursor,
  bySuppliedId,
  defaultPage,
  deleteOptions,
}: {
  readonly byCursor?: Record<string, ReturnType<typeof fileCollectionsPage>>;
  readonly bySuppliedId?: Record<string, ReturnType<typeof fileCollectionsPage>>;
  readonly defaultPage: ReturnType<typeof fileCollectionsPage>;
  readonly deleteOptions?: Parameters<typeof deleteFileCollections>[0];
}): void {
  server.use(
    listFileCollections({
      byCursor,
      bySuppliedId,
      defaultPage,
    }),
    deleteFileCollections(deleteOptions)
  );
}
