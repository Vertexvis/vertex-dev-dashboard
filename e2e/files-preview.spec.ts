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

test("offers Create Part from an existing complete file", async ({ page }) => {
  await page.route("**/api/files**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(filePage),
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
});
