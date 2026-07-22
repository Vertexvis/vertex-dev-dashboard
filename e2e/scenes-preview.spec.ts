import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("opens Scene Workspace from the additive Scenes Preview table", async ({
  page,
}) => {
  await page.route("**/api/scenes**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: {
              created: "2026-07-21T12:00:00Z",
              name: "Preview scene",
              state: "ready",
              suppliedId: "preview-1",
            },
            id: "scene-1",
            type: "scene",
          },
        ],
        status: 200,
      }),
    });
  });
  await page.route("**/api/scenes/scene-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        attributes: {
          name: "Preview scene",
          state: "ready",
          suppliedId: "preview-1",
        },
        id: "scene-1",
        type: "scene",
      }),
    });
  });
  await page.route("**/api/stream-keys", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({ message: "Forbidden", status: 403 }),
    });
  });

  await page.goto("/scenes-preview");
  await expect(
    page.getByText("Scenes (Preview)", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel("Open workspace for Preview scene")
  ).toHaveAttribute("href", "/scene-workspace/scene-1");

  await page.getByText("READY").click();
  await expect(
    page.getByRole("heading", { name: "Scene Details" })
  ).toBeVisible();

  await page.getByLabel("Open workspace for Preview scene").click();
  await expect(page).toHaveURL("/scene-workspace/scene-1");
});
