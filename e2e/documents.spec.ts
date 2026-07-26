import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

const tinyPdf = readFileSync(join(__dirname, "fixtures", "tiny.pdf"));

function documentData(id: string, suppliedId?: string) {
  return {
    attributes: {
      createdAt: "2026-07-21T12:00:00Z",
      documentType: "PDF",
      fileId: "fixture-file-1",
      suppliedId,
    },
    id,
    type: "document",
  };
}

test("exercises Documents Preview list, filter, pages, detail, and registration", async ({
  page,
}) => {
  const listRequests: URL[] = [];
  let createBody: unknown;
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: { name: "fixture-file.pdf", status: "complete" },
            id: "fixture-file-1",
            type: "file",
          },
        ],
        status: 200,
      }),
    });
  });
  await page.route("**/api/documents**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      createBody = request.postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify(documentData("created-document", "created-id")),
      });
      return;
    }
    if (url.pathname.endsWith("/doc-filter")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(documentData("doc-filter", "filter-id")),
      });
      return;
    }
    listRequests.push(url);
    const cursor = url.searchParams.get("cursor");
    const suppliedId = url.searchParams.get("suppliedId");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: cursor ? {} : { next: "cursor-2" },
        data: [
          documentData(
            suppliedId ? "doc-filter" : cursor ? "doc-page-2" : "doc-page-1",
            suppliedId ?? undefined
          ),
        ],
        status: 200,
      }),
    });
  });

  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Documents", exact: true })
  ).toBeVisible();
  await expect(page.getByText("doc-page-1")).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("doc-page-2")).toBeVisible();
  await page.getByLabel("Supplied ID filter").fill("filter-id");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("doc-filter")).toBeVisible();
  expect(listRequests.at(-1)?.searchParams.get("suppliedId")).toBe("filter-id");
  expect(listRequests.at(-1)?.searchParams.has("cursor")).toBe(false);

  await page.getByRole("button", { name: "doc-filter" }).click();
  await expect(
    page.getByRole("heading", { name: "Document details" })
  ).toBeVisible();
  await expect(page.getByText("File: fixture-file-1")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Completed source file").click();
  await page.getByRole("option", { name: "fixture-file.pdf" }).click();
  await page.getByLabel("Supplied ID (optional)").fill("created-id");
  await page.getByRole("button", { name: "Register document" }).click();
  await expect
    .poll(() => createBody)
    .toEqual({
      fileId: "fixture-file-1",
      suppliedId: "created-id",
    });
});

test("keeps Documents registration read-only when Preview is forbidden", async ({
  page,
}) => {
  await page.route("**/api/documents**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({ message: "Forbidden", status: 403 }),
    });
  });
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: { name: "fixture-file.pdf", status: "complete" },
            id: "fixture-file-1",
            type: "file",
          },
        ],
        status: 200,
      }),
    });
  });

  await page.goto("/documents");
  await expect(
    page.getByText("Document Preview is unavailable for this account.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register document" })
  ).toBeDisabled();
});

test("previews a document's PDF inline from the details drawer", async ({
  page,
}) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: { name: "fixture-file.pdf", status: "complete" },
            id: "fixture-file-1",
            type: "file",
          },
        ],
        status: 200,
      }),
    });
  });
  // Register the list route first, then the detail route: Playwright matches
  // routes most-recently-registered first, so the specific detail handler must
  // win over the broader `**/api/documents**` glob for `/api/documents/<id>`.
  await page.route("**/api/documents**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [documentData("doc-preview", "preview-id")],
        status: 200,
      }),
    });
  });
  await page.route("**/api/documents/doc-preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(documentData("doc-preview", "preview-id")),
    });
  });
  await page.route("**/api/files/*/inline**", async (route) => {
    await route.fulfill({
      contentType: "application/pdf",
      body: tinyPdf,
    });
  });

  await page.goto("/documents");
  await page.getByRole("button", { name: "doc-preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Document details" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("PDF preview of fixture-file.pdf")
  ).toBeVisible();
  await expect(dialog.getByRole("link", { name: /download/i })).toHaveAttribute(
    "href",
    "/api/files/fixture-file-1/download"
  );
});
