import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("manages collection membership through the SSR-safe local fixture", async ({
  page,
}) => {
  await page.goto("/file-collections/collection-1");

  await expect(
    page.getByRole("heading", { name: "File Collection Details" }).first()
  ).toBeVisible();
  await expect(page.getByText("fixture-file.jt")).toBeVisible();

  // The fixture upstream ignores filter params, so this exercises the
  // route's temporary stand-in page filtering.
  const nameFilter = page.getByLabel("Name", { exact: true });
  await nameFilter.fill("does-not-match");
  await expect(page.getByText("fixture-file.jt")).toBeHidden();
  await nameFilter.fill("FIXTURE");
  await expect(page.getByText("fixture-file.jt")).toBeVisible();
  await nameFilter.clear();
  await expect(page.getByText("fixture-file.jt")).toBeVisible();

  await page.getByRole("button", { name: "Add completed files" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (const column of ["Name", "Supplied ID", "Status", "ID"]) {
    await expect(
      page.getByRole("columnheader", { exact: true, name: column })
    ).toBeVisible();
  }
  await expect(page.getByText("No files selected yet.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Select fixture-file.jt" }).check();
  await expect(page.getByText("Selected files (1)")).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Selected files" })
      .getByText("fixture-file.jt")
  ).toBeVisible();
  await page.getByRole("button", { name: "Add 1 file" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Archive job is running.")).toHaveCount(0);
});
