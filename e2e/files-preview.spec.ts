import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

const filePage = {
  cursors: { next: null, previous: null, self: null },
  data: [
    {
      attributes: {
        created: "2026-07-21T12:00:00Z",
        name: "fixture-file.jt",
        status: "complete",
        suppliedId: "fixture-1",
        uploaded: "2026-07-21T12:01:00Z",
      },
      id: "fixture-file-1",
      type: "file",
    },
  ],
  status: 200,
};

const previewablePage = {
  cursors: { next: null, previous: null, self: null },
  data: [
    {
      attributes: {
        created: "2026-07-21T12:00:00Z",
        name: "fixture-image.png",
        size: 2048,
        status: "complete",
        suppliedId: "fixture-image-1",
        uploaded: "2026-07-21T12:01:00Z",
      },
      id: "fixture-image-1",
      type: "file",
    },
    {
      attributes: {
        created: "2026-07-21T12:00:00Z",
        name: "fixture-model.jt",
        status: "complete",
        suppliedId: "fixture-model-1",
        uploaded: "2026-07-21T12:01:00Z",
      },
      id: "fixture-model-1",
      type: "file",
    },
  ],
  status: 200,
};

const tinyPng = readFileSync(join(__dirname, "fixtures", "tiny.png"));

test.use({ storageState: "e2e/.auth/session.json" });

test("loads the authenticated Files (Preview) table from a local fixture", async ({
  page,
}) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(filePage),
    });
  });

  await page.goto("/files-preview");
  await expect(
    page.getByRole("main").getByText("Files", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("fixture-file.jt")).toBeVisible();
});

test("creates a part from an existing complete file and links the toast to translations", async ({
  page,
}) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(filePage),
    });
  });
  await page.route("**/api/parts", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "job-preview-1", status: 200 }),
    });
  });

  await page.goto("/files-preview");
  await expect(page.getByText("fixture-file.jt")).toBeVisible();

  await page.getByLabel("Actions for fixture-file.jt").click();
  await page.getByRole("menuitem", { name: "Create Part" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create Part" })
  ).toBeVisible();
  await expect(dialog.getByText("fixture-file.jt")).toBeVisible();

  // Submit stays disabled until the required fields are filled; filling them
  // must enable it even though the target file arrived via props on a row
  // action (guards the persistent-mount enablement regression).
  const createButton = dialog.getByRole("button", { name: "Create" });
  await expect(createButton).toBeDisabled();
  await dialog.getByLabel(/^Supplied ID/).fill("e2e-supplied-1");
  await dialog.getByLabel(/^Supplied Revision ID/).fill("e2e-rev-1");
  await expect(createButton).toBeEnabled();

  await createButton.click();

  await expect(
    page.getByText("Translation initiated. Job ID: job-preview-1")
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View translations" })
  ).toHaveAttribute("href", "/translations");
});

test("previews an image inline and always offers a download", async ({
  page,
}) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(previewablePage),
    });
  });
  await page.route("**/api/files/*/inline**", async (route) => {
    await route.fulfill({
      contentType: "image/png",
      body: tinyPng,
    });
  });

  await page.goto("/files-preview");
  await expect(page.getByText("fixture-image.png")).toBeVisible();

  await page.getByLabel("Actions for fixture-image.png").click();
  await page.getByRole("menuitem", { name: "Preview" }).click();

  const dialog = page.getByRole("dialog");
  const img = dialog.getByRole("img", { name: "fixture-image.png" });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute(
    "src",
    "/api/files/fixture-image-1/inline?name=fixture-image.png"
  );
  await expect(dialog.getByRole("link", { name: /download/i })).toHaveAttribute(
    "href",
    "/api/files/fixture-image-1/download"
  );
});

test("offers no Preview action for a non-previewable file type", async ({
  page,
}) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(previewablePage),
    });
  });

  await page.goto("/files-preview");
  await expect(page.getByText("fixture-model.jt")).toBeVisible();

  await page.getByLabel("Actions for fixture-model.jt").click();
  await expect(page.getByRole("menuitem", { name: "Preview" })).toHaveCount(0);
  // A row action menu still exists (Download / Create Part), just not Preview.
  await expect(
    page.getByRole("menuitem", { name: "Download file" })
  ).toBeVisible();
});
