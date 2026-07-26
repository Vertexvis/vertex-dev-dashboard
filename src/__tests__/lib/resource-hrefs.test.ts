import {
  getFileCollectionHref,
  getSceneHref,
  getSceneWorkspaceHref,
  resourceHref,
} from "../../lib/resource-hrefs";

describe("resource-hrefs", () => {
  it("builds scene viewer, workspace, and file collection hrefs", () => {
    expect(getSceneHref("scene-1")).toBe("/scene-viewer/scene-1");
    expect(getSceneWorkspaceHref("scene-1")).toBe("/scene-workspace/scene-1");
    expect(getFileCollectionHref("collection-1")).toBe(
      "/file-collections/collection-1"
    );
  });

  it("encodes ids that contain URL-sensitive characters", () => {
    expect(getSceneHref("a b/c?d")).toBe("/scene-viewer/a%20b%2Fc%3Fd");
    expect(getFileCollectionHref("a/b")).toBe("/file-collections/a%2Fb");
  });

  it("resolves hrefs by resource type", () => {
    expect(resourceHref({ type: "scene", id: "s1" })).toBe("/scene-viewer/s1");
    expect(resourceHref({ type: "scene-workspace", id: "s1" })).toBe(
      "/scene-workspace/s1"
    );
    expect(resourceHref({ type: "file-collection", id: "c1" })).toBe(
      "/file-collections/c1"
    );
  });

  it("returns undefined for resource types without a dedicated page", () => {
    expect(resourceHref({ type: "file", id: "f1" })).toBeUndefined();
    expect(resourceHref({ type: "part", id: "p1" })).toBeUndefined();
    expect(resourceHref({ type: "part-revision", id: "pr1" })).toBeUndefined();
    expect(resourceHref({ type: "translation", id: "t1" })).toBeUndefined();
  });
});
