import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("inspects scene assembly and views without exposing stream keys", async ({
  page,
}) => {
  const routeRequests: string[] = [];
  await page.route("**/api/scenes/scene-1", async (route) => {
    routeRequests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        attributes: {
          name: "Fixture scene",
          sceneItemCount: 1,
          state: "committed",
          suppliedId: "fixture-scene",
        },
        id: "scene-1",
        type: "scene",
      }),
    });
  });
  await page.route("**/api/scene-workspace-items**", async (route) => {
    routeRequests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: { name: "Assembly item", suppliedId: "item-1" },
            id: "item-1",
            type: "scene-item",
          },
        ],
        status: 200,
      }),
    });
  });
  await page.route("**/api/scene-workspace-views**", async (route) => {
    routeRequests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: {},
        data: [
          {
            attributes: { created: "2026-07-21T12:00:00Z" },
            id: "view-1",
            type: "scene-view",
          },
        ],
        status: 200,
      }),
    });
  });

  await page.goto("/scene-workspace/scene-1");
  await expect(
    page.getByRole("heading", { name: "Scene Workspace" })
  ).toBeVisible();
  await expect(page.getByText("Fixture scene")).toBeVisible();

  await page.getByRole("tab", { name: "Assembly" }).click();
  await expect(page.getByText("Assembly item")).toBeVisible();

  await page.getByRole("tab", { name: "Views & states" }).click();
  await page.getByText("view-1").click();
  await expect(page.getByText("Scene saved states")).toBeVisible();
  await expect(
    page.getByText(
      "Vertex lists saved states for a scene, not for a selected scene view."
    )
  ).toBeVisible();

  expect(routeRequests.join("\n")).not.toContain("stream-key");
  expect(routeRequests.join("\n")).not.toContain("scene-view-states");
  expect(page.url()).not.toContain("streamKey");
});
