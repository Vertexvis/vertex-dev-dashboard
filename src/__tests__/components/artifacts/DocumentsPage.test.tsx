import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { DocumentsPage } from "../../../components/artifacts/DocumentsPage";

describe("DocumentsPage", () => {
  installJsdomMockServer();

  it("clears the cursor before applying a supplied-ID filter", async () => {
    const requests: string[] = [];
    server.use(
      http.get("*/api/documents", ({ request }) => {
        requests.push(request.url);
        const url = new URL(request.url);
        const cursor = url.searchParams.get("cursor");
        const suppliedId = url.searchParams.get("suppliedId");
        return HttpResponse.json({
          cursors: cursor ? {} : { next: "cursor-2" },
          data: [
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "PDF",
                fileId: "file-1",
                suppliedId,
              },
              id: cursor ? "doc-2" : "doc-1",
              type: "document",
            },
          ],
          status: 200,
        });
      }),
      http.get("*/api/files", () =>
        HttpResponse.json({ cursors: {}, data: [], status: 200 })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<DocumentsPage />);

    await user.click(await screen.findByRole("button", { name: "Next page" }));
    await screen.findByRole("button", { name: "First page" });
    await user.type(screen.getByLabelText("Supplied ID filter"), "fixture-id");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await screen.findByText("fixture-id");
    const lastRequest = new URL(requests.at(-1) ?? "http://localhost");
    expect(lastRequest.searchParams.get("suppliedId")).toBe("fixture-id");
    expect(lastRequest.searchParams.has("cursor")).toBe(false);
  });

  it("makes Preview registration read-only when the capability is forbidden", async () => {
    server.use(
      http.get("*/api/documents", () =>
        HttpResponse.json({ message: "Forbidden", status: 403 })
      ),
      http.get("*/api/files", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: { name: "complete.pdf", status: "complete" },
              id: "file-1",
              type: "file",
            },
          ],
          status: 200,
        })
      )
    );
    renderWithSWR(<DocumentsPage />);
    expect(
      await screen.findByText(
        /Document Preview is unavailable for this account/
      )
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Register document" })
    ).toBeDisabled();
  });

  it("uses the existing PDF icon and uppercase fallback in the type column", async () => {
    server.use(
      http.get("*/api/documents", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "PDF",
                fileId: "file-1",
              },
              id: "pdf-document",
              type: "document",
            },
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "custom-type",
                fileId: "file-2",
              },
              id: "custom-document",
              type: "document",
            },
          ],
          status: 200,
        })
      ),
      http.get("*/api/files", () =>
        HttpResponse.json({ cursors: {}, data: [], status: 200 })
      )
    );
    renderWithSWR(<DocumentsPage />);

    expect(await screen.findByLabelText("PDF document")).toBeVisible();
    expect(screen.getByText("CUSTOM-TYPE")).toBeVisible();
  });

  it("toggles Files-column labels between available filenames and File IDs", async () => {
    server.use(
      http.get("*/api/documents", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "PDF",
                fileId: "file-with-name",
              },
              id: "named-document",
              type: "document",
            },
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "PDF",
                fileId: "file-without-name",
              },
              id: "unnamed-document",
              type: "document",
            },
          ],
          status: 200,
        })
      ),
      http.get("*/api/files", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: { name: "source-file.pdf", status: "complete" },
              id: "file-with-name",
              type: "file",
            },
          ],
          status: 200,
        })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<DocumentsPage />);

    const namedFileLink = await screen.findByRole("link", {
      name: "Open file file-with-name",
    });
    expect(namedFileLink).toHaveTextContent("source-file.pdf");
    expect(
      screen.getByRole("link", { name: "Open file file-without-name" })
    ).toHaveTextContent("file-without-name");

    await user.click(screen.getByRole("button", { name: "Display File IDs" }));
    expect(namedFileLink).toHaveTextContent("file-with-name");

    await user.click(screen.getByRole("button", { name: "Display filenames" }));
    expect(namedFileLink).toHaveTextContent("source-file.pdf");
    expect(
      screen.getByRole("link", { name: "Open file file-without-name" })
    ).toHaveTextContent("file-without-name");
  });

  it("opens associated Files from the table and detail using the File view state", async () => {
    server.use(
      http.get("*/api/documents", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                createdAt: "2026-07-21T12:00:00Z",
                documentType: "PDF",
                fileId: "file-1",
              },
              id: "document-1",
              type: "document",
            },
          ],
          status: 200,
        })
      ),
      http.get("*/api/documents/document-1", () =>
        HttpResponse.json({
          attributes: {
            createdAt: "2026-07-21T12:00:00Z",
            documentType: "PDF",
            fileId: "file-1",
          },
          id: "document-1",
          type: "document",
        })
      ),
      http.get("*/api/files", () =>
        HttpResponse.json({ cursors: {}, data: [], status: 200 })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<DocumentsPage />);

    const tableFileLink = await screen.findByRole("link", {
      name: "Open file file-1",
    });
    expect(tableFileLink).toHaveAttribute("href", "/files?fileId=file-1");
    await user.click(screen.getByRole("button", { name: "document-1" }));
    const fileLinks = await screen.findAllByRole("link", {
      name: "Open file file-1",
    });
    const detailFileLink = fileLinks.at(-1);
    if (detailFileLink == null) throw new Error("Expected a detail File link.");
    expect(detailFileLink).toHaveAttribute("href", "/files?fileId=file-1");
  });
});
