import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

const scenesPayload = {
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
};

const scenePayload = {
  attributes: {
    name: "Preview scene",
    state: "ready",
    suppliedId: "preview-1",
  },
  id: "scene-1",
  type: "scene",
};

test("double-clicks a scene row to open its dedicated page and honors the setting toggle", async ({
  page,
}) => {
  await page.route("**/api/scenes**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(scenesPayload),
    });
  });
  await page.route("**/api/scenes/scene-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(scenePayload),
    });
  });
  await page.route("**/api/stream-keys", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "local-fixture-key", status: 200 }),
    });
  });

  await page.goto("/scenes-preview");
  await expect(
    page.getByText("Scenes (Preview)", { exact: true })
  ).toBeVisible();

  // The setting defaults on and is exposed via the Settings panel.
  await page.getByRole("button", { name: "Open settings" }).click();
  const toggle = page.getByRole("checkbox", {
    name: "Open the resource page on double-click",
  });
  await expect(toggle).toBeChecked();

  // Turn the setting OFF first and confirm double-click no longer navigates
  // while single-click still opens the drawer. Target a plain data cell so we
  // exercise the row handler, not the name-cell resource link.
  await toggle.uncheck();
  await page.getByRole("button", { name: "Close settings" }).click();

  const row = page.getByRole("cell", { name: "scene-1", exact: true });
  await row.click();
  await expect(
    page.getByRole("heading", { name: "Scene Details" })
  ).toBeVisible();

  await row.dblclick();
  await expect(page).toHaveURL("/scenes-preview");

  // Turn the setting back ON; double-click now navigates to the dedicated
  // workspace page. This is the final action so no return trip is needed.
  await page.getByRole("button", { name: "Open settings" }).click();
  await page
    .getByRole("checkbox", { name: "Open the resource page on double-click" })
    .check();
  await page.getByRole("button", { name: "Close settings" }).click();

  await page.getByRole("cell", { name: "scene-1", exact: true }).dblclick();
  await expect(page).toHaveURL("/scene-workspace/scene-1");
});
