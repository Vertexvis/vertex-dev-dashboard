import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("sizes the embedded workspace viewer through the supported host override", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.route("**/api/scenes/scene-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        attributes: { name: "Fixture scene", state: "committed" },
        id: "scene-1",
        type: "scene",
      }),
    });
  });
  await page.route("**/api/stream-keys", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "local-fixture-key", status: 200 }),
    });
  });

  await page.goto("/scene-workspace/scene-1");
  const preview = page.getByLabel("Scene preview viewer");
  const viewer = page.getByTestId("scene-workspace-viewer");
  await expect(preview).toBeVisible();
  await expect(viewer).toBeVisible();

  const [previewBounds, viewerBounds] = await Promise.all([
    preview.boundingBox(),
    viewer.boundingBox(),
  ]);
  expect(previewBounds?.width).toBeGreaterThan(700);
  expect(previewBounds?.height).toBeGreaterThan(300);
  expect(viewerBounds?.width).toBe(previewBounds?.width);
  expect(viewerBounds?.height).toBe(previewBounds?.height);
});
