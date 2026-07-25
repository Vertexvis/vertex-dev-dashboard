import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { AddFilesToCollectionDialog } from "../../../components/file-collection/AddFilesToCollectionDialog";

const targetFileId = "46cf5c0f-1b14-4797-b8aa-ca73c7dd006f";

describe("AddFilesToCollectionDialog", () => {
  installJsdomMockServer();

  it("renders eligible files in a mini table with identifying columns", async () => {
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json(
          filePage([
            fileResource({
              id: targetFileId,
              name: "Complete file",
              status: "complete",
              suppliedId: "PN-0174",
            }),
            fileResource({
              id: "pending-file",
              name: "Pending file",
              status: "pending",
              suppliedId: "PN-0175",
            }),
          ])
        )
      )
    );

    renderDialog();

    expect(await screen.findByText("Complete file")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Eligible files" });
    expect(table).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("columnheader")
        .map((columnHeader) => columnHeader.textContent)
    ).toEqual(["", "Name", "Supplied ID", "Status", "ID"]);
    expect(screen.getByText("PN-0174")).toBeInTheDocument();
    expect(screen.getByText(targetFileId)).toHaveStyle({
      fontFamily: "monospace",
    });
    expect(screen.getByText("complete").closest(".MuiChip-root")).toHaveStyle({
      textTransform: "uppercase",
    });
    expect(
      screen.getByRole("checkbox", { name: "Select Complete file" })
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Select Pending file" })
    ).toBeDisabled();
  });

  it("looks up a file by lowercased ID when the search is a UUID and keeps prior selections", async () => {
    const listFiles = jest.fn(({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("fileId") === targetFileId) {
        return HttpResponse.json(
          filePage([
            fileResource({
              id: targetFileId,
              name: "Deep file",
              status: "complete",
              suppliedId: "PN-0174",
            }),
          ])
        );
      }

      return HttpResponse.json(
        filePage([
          fileResource({
            id: "file-1",
            name: "First file",
            status: "complete",
            suppliedId: "PN-0001",
          }),
        ])
      );
    });
    const addFiles = jest.fn(async ({ request }) => {
      expect(await request.json()).toEqual({
        fileIds: ["file-1", targetFileId],
      });
      return HttpResponse.json({ status: 200 });
    });
    const onMembersAdded = jest.fn();
    server.use(
      http.get("*/api/files", (info) => listFiles(info)),
      http.post("*/api/file-collections/collection-1/files", (info) =>
        addFiles(info)
      )
    );

    renderDialog({ onMembersAdded });

    expect(await screen.findByText("First file")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select First file" })
    );

    await userEvent.click(screen.getByLabelText("Search files"));
    await userEvent.paste(targetFileId.toUpperCase());

    expect(await screen.findByText("Deep file")).toBeInTheDocument();
    const idLookups = listFiles.mock.calls.filter(
      ([{ request }]: [{ request: Request }]) =>
        new URL(request.url).searchParams.get("fileId") === targetFileId
    );
    expect(idLookups.length).toBeGreaterThan(0);
    for (const [{ request }] of listFiles.mock.calls as [
      { request: Request }
    ][]) {
      const url = new URL(request.url);
      expect(url.searchParams.get("fileId")).not.toBe(
        targetFileId.toUpperCase()
      );
      expect(url.searchParams.get("name")).not.toBe(targetFileId);
      expect(url.searchParams.get("suppliedId")).not.toBe(targetFileId);
    }

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Deep file" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Add 2 files" }));

    await waitFor(() => expect(addFiles).toHaveBeenCalledTimes(1));
    expect(onMembersAdded).toHaveBeenCalledTimes(1);
  });

  it("matches supplied IDs when searching by text", async () => {
    const listFiles = jest.fn(({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("name") === "PN-01") {
        return HttpResponse.json(
          filePage([
            fileResource({
              id: "file-named",
              name: "PN-0100 drawing",
              status: "complete",
              suppliedId: "OTHER-1",
            }),
            fileResource({
              id: "file-both",
              name: "PN-0101 model",
              status: "complete",
              suppliedId: "PN-0101",
            }),
          ])
        );
      }
      if (url.searchParams.get("suppliedId") === "PN-01") {
        return HttpResponse.json(
          filePage([
            fileResource({
              id: "file-both",
              name: "PN-0101 model",
              status: "complete",
              suppliedId: "PN-0101",
            }),
            fileResource({
              id: "file-supplied",
              name: "Unrelated name",
              status: "complete",
              suppliedId: "PN-0102",
            }),
          ])
        );
      }

      return HttpResponse.json(filePage([]));
    });
    server.use(http.get("*/api/files", (info) => listFiles(info)));

    renderDialog();

    expect(await screen.findByText("No matching files.")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Search files"));
    await userEvent.paste("PN-01");

    expect(await screen.findByText("PN-0100 drawing")).toBeInTheDocument();
    expect(await screen.findByText("Unrelated name")).toBeInTheDocument();
    expect(screen.getAllByText("PN-0101 model")).toHaveLength(1);
  });

  it("does not report no matches while the supplied ID lookup is in flight", async () => {
    let nameLookupSettled = false;
    let releaseSuppliedIdLookup!: () => void;
    const suppliedIdLookupReleased = new Promise<void>((resolve) => {
      releaseSuppliedIdLookup = resolve;
    });
    server.use(
      http.get("*/api/files", async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("suppliedId") === "PN-01") {
          await suppliedIdLookupReleased;
          return HttpResponse.json(
            filePage([
              fileResource({
                id: "file-supplied",
                name: "Unrelated name",
                status: "complete",
                suppliedId: "PN-0102",
              }),
            ])
          );
        }
        if (url.searchParams.get("name") === "PN-01") nameLookupSettled = true;
        return HttpResponse.json(filePage([]));
      })
    );

    renderDialog();

    expect(await screen.findByText("No matching files.")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Search files"));
    await userEvent.paste("PN-01");

    await waitFor(() => expect(nameLookupSettled).toBe(true));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByText("No matching files.")).not.toBeInTheDocument();

    releaseSuppliedIdLookup();

    expect(await screen.findByText("Unrelated name")).toBeInTheDocument();
  });

  it("shows queued files in the selected panel and keeps them across searches", async () => {
    const listFiles = jest.fn(({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("name") === "Second") {
        return HttpResponse.json(
          filePage([
            fileResource({
              id: "file-2",
              name: "Second file",
              status: "complete",
              suppliedId: "PN-0002",
            }),
          ])
        );
      }
      if (url.searchParams.get("suppliedId") != null) {
        return HttpResponse.json(filePage([]));
      }

      return HttpResponse.json(
        filePage([
          fileResource({
            id: "file-1",
            name: "First file",
            status: "complete",
            suppliedId: "PN-0001",
          }),
        ])
      );
    });
    server.use(http.get("*/api/files", (info) => listFiles(info)));

    renderDialog();

    expect(await screen.findByText("First file")).toBeInTheDocument();
    expect(screen.getByText("Selected files (0)")).toBeInTheDocument();
    expect(screen.getByText("No files selected yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Selected files" })
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select First file" })
    );

    expect(screen.getByText("Selected files (1)")).toBeInTheDocument();
    expect(
      screen.queryByText("No files selected yet.")
    ).not.toBeInTheDocument();
    const panel = screen.getByRole("list", { name: "Selected files" });
    expect(within(panel).getByText("First file")).toBeInTheDocument();
    expect(within(panel).getByText("PN-0001")).toBeInTheDocument();
    expect(within(panel).getByText("file-1")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Search files"));
    await userEvent.paste("Second");

    expect(await screen.findByText("Second file")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Select First file" })
    ).not.toBeInTheDocument();
    const retainedPanel = screen.getByRole("list", { name: "Selected files" });
    expect(within(retainedPanel).getByText("First file")).toBeInTheDocument();
    expect(within(retainedPanel).getByText("PN-0001")).toBeInTheDocument();
    expect(screen.getByText("Selected files (1)")).toBeInTheDocument();
  });

  it("removes queued files from the panel and posts only remaining selections", async () => {
    const addFiles = jest.fn(async ({ request }) => {
      expect(await request.json()).toEqual({ fileIds: ["file-2"] });
      return HttpResponse.json({ status: 200 });
    });
    const onClose = jest.fn();
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json(
          filePage([
            fileResource({
              id: "file-1",
              name: "First file",
              status: "complete",
              suppliedId: "PN-0001",
            }),
            fileResource({
              id: "file-2",
              name: "Second file",
              status: "complete",
              suppliedId: "PN-0002",
            }),
          ])
        )
      ),
      http.post("*/api/file-collections/collection-1/files", (info) =>
        addFiles(info)
      )
    );

    renderDialog({ onClose });

    expect(await screen.findByText("First file")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select First file" })
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Second file" })
    );
    expect(screen.getByText("Selected files (2)")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove First file" })
    );

    expect(screen.getByText("Selected files (1)")).toBeInTheDocument();
    const panel = screen.getByRole("list", { name: "Selected files" });
    expect(within(panel).queryByText("First file")).not.toBeInTheDocument();
    expect(within(panel).getByText("Second file")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select First file" })
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select Second file" })
    ).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Add 1 file" }));

    await waitFor(() => expect(addFiles).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets a queued file be unchecked after its status regresses", async () => {
    const listFiles = jest.fn(({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("name") === "Regressed") {
        return HttpResponse.json(
          filePage([
            fileResource({
              id: "file-1",
              name: "Regressed file",
              status: "pending",
              suppliedId: "PN-0001",
            }),
          ])
        );
      }
      if (url.searchParams.get("suppliedId") != null) {
        return HttpResponse.json(filePage([]));
      }

      return HttpResponse.json(
        filePage([
          fileResource({
            id: "file-1",
            name: "Regressed file",
            status: "complete",
            suppliedId: "PN-0001",
          }),
        ])
      );
    });
    server.use(http.get("*/api/files", (info) => listFiles(info)));

    renderDialog();

    expect(await screen.findByText("Regressed file")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Regressed file" })
    );
    expect(screen.getByText("Selected files (1)")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Search files"));
    await userEvent.paste("Regressed");

    expect(await screen.findByText("pending")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", {
      name: "Select Regressed file",
    });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeEnabled();

    await userEvent.click(screen.getByRole("row", { name: /Regressed file/ }));

    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.getByText("Selected files (0)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("row", { name: /Regressed file/ }));

    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Selected files (0)")).toBeInTheDocument();
  });

  it("returns to the empty selected state when every file is removed", async () => {
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json(
          filePage([
            fileResource({
              id: "file-1",
              name: "First file",
              status: "complete",
              suppliedId: "PN-0001",
            }),
          ])
        )
      )
    );

    renderDialog();

    expect(await screen.findByText("First file")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select First file" })
    );
    expect(screen.getByText("Selected files (1)")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove First file" })
    );

    expect(screen.getByText("Selected files (0)")).toBeInTheDocument();
    expect(screen.getByText("No files selected yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeDisabled();
  });

  it("adds only completed files through the collection membership route", async () => {
    const addFiles = jest.fn(async ({ request }) => {
      expect(await request.json()).toEqual({ fileIds: ["complete-file"] });
      return HttpResponse.json({ status: 200 });
    });
    const onMembersAdded = jest.fn();
    const onClose = jest.fn();
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json(
          filePage([
            fileResource({
              id: "complete-file",
              name: "Complete file",
              status: "complete",
              suppliedId: "complete",
            }),
            fileResource({
              id: "pending-file",
              name: "Pending file",
              status: "pending",
              suppliedId: "pending",
            }),
          ])
        )
      ),
      http.post("*/api/file-collections/collection-1/files", (info) =>
        addFiles(info)
      )
    );

    renderDialog({ onClose, onMembersAdded });

    expect(await screen.findByText("Complete file")).toBeInTheDocument();
    expect(screen.getByText("Pending file")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Complete file" })
    );
    expect(
      screen.getByRole("checkbox", { name: "Select Pending file" })
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Add 1 file" }));

    await waitFor(() => expect(addFiles).toHaveBeenCalledTimes(1));
    expect(onMembersAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function renderDialog({
  onClose = jest.fn(),
  onMembersAdded = jest.fn(),
}: {
  readonly onClose?: jest.Mock;
  readonly onMembersAdded?: jest.Mock;
} = {}): void {
  renderWithSWR(
    <AddFilesToCollectionDialog
      collectionId="collection-1"
      onClose={onClose}
      onMembersAdded={onMembersAdded}
      open
    />
  );
}

function filePage(data: ReturnType<typeof fileResource>[]): {
  cursors: { self: string };
  data: ReturnType<typeof fileResource>[];
  status: number;
} {
  return {
    cursors: { self: "page-1" },
    data,
    status: 200,
  };
}

function fileResource({
  created = "2026-06-12T15:30:00Z",
  id,
  name,
  status,
  suppliedId,
  uploaded = "2026-06-12T15:31:00Z",
}: {
  readonly created?: string;
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly suppliedId: string;
  readonly uploaded?: string;
}) {
  return {
    type: "file",
    id,
    attributes: {
      created,
      name,
      status,
      suppliedId,
      uploaded,
    },
  } as const;
}
