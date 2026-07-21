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

  await page.getByRole("button", { name: "Add completed files" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "fixture-file.jt (complete)" })
    .check();
  await page.getByRole("button", { name: "Add files" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Archive job is running.")).toHaveCount(0);
});
