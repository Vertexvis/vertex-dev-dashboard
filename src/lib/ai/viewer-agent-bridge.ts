import { ViewerCommand, ViewerCommandResult } from "./viewer-command";

export class ViewerAgentBridge {
  public constructor(private readonly viewer: HTMLVertexViewerElement) {}

  public async execute(
    commandId: string,
    command: ViewerCommand
  ): Promise<ViewerCommandResult> {
    try {
      if (command.type === "scene_tree_action") {
        const tree = document.querySelector(
          "#vertex-scene-tree"
        ) as HTMLVertexSceneTreeElement | null;
        if (tree == null) throw new Error("The scene tree is not ready.");
        if (command.operation === "expand_root") await tree.expandItem(0);
        else if (command.operation === "collapse_root")
          await tree.collapseItem(0);
        else if (command.operation === "expand_all") await tree.expandAll();
        else await tree.collapseAll();
        return { commandId, ok: true };
      }
      const scene = await this.viewer.scene();
      if (command.type === "reset_view") {
        await scene.reset({
          includeCamera: command.scope === "camera" || command.scope === "all",
        });
      } else {
        if (command.type === "scene_transaction") {
          await scene
            .items((op) =>
              command.steps.map((step) => {
                const items =
                  step.target === "root"
                    ? op.where((query) => query.all())
                    : step.target === "selected"
                    ? op.where((query) => query.withSelected())
                    : step.target === "visible"
                    ? op.where((query) => query.withVisible())
                    : op.where((query) =>
                        query.withMetadata(
                          step.query?.metadata.filter ?? "",
                          step.query?.metadata.keys ?? [],
                          false
                        )
                      );
                return step.operation === "show"
                  ? items.show()
                  : step.operation === "hide"
                  ? items.hide()
                  : step.operation === "ghost"
                  ? items.setPhantom(true)
                  : items.clearPhantom();
              })
            )
            .execute();
          return { commandId, ok: true };
        }
        if (
          command.type === "scene_action" &&
          command.operation === "show_only"
        ) {
          await scene
            .items((op) => [
              op.where((query) => query.all()).hide(),
              command.target === "root"
                ? op.where((query) => query.all()).show()
                : command.target === "selected"
                ? op.where((query) => query.withSelected()).show()
                : command.target === "visible"
                ? op.where((query) => query.withVisible()).show()
                : op
                    .where((query) =>
                      query.withMetadata(
                        command.query?.metadata.filter ?? "",
                        command.query?.metadata.keys ?? [],
                        false
                      )
                    )
                    .show(),
            ])
            .execute();
          await scene
            .camera()
            .viewAll()
            .render({
              animation: { milliseconds: 750 },
            });
          return { commandId, ok: true };
        }
        await scene
          .items((op) => {
            if (command.type === "scene_action") {
              const items =
                command.target === "root"
                  ? op.where((query) => query.all())
                  : command.target === "selected"
                  ? op.where((query) => query.withSelected())
                  : command.target === "visible"
                  ? op.where((query) => query.withVisible())
                  : op.where((query) =>
                      query.withMetadata(
                        command.query?.metadata.filter ?? "",
                        command.query?.metadata.keys ?? [],
                        false
                      )
                    );
              return command.operation === "show"
                ? items.show()
                : command.operation === "hide"
                ? items.hide()
                : command.operation === "select"
                ? items.select()
                : command.operation === "deselect"
                ? items.deselect()
                : command.operation === "ghost"
                ? items.setPhantom(true)
                : command.operation === "unghost"
                ? items.clearPhantom()
                : command.operation === "highlight" ||
                  command.operation === "paint"
                ? items.materialOverride(command.color ?? "#ffff00")
                : command.operation === "clear_highlight"
                ? items.clearMaterialOverrides()
                : command.operation === "transform"
                ? items.transform(command.transform ?? [])
                : command.operation === "clear_transforms"
                ? items.clearTransforms()
                : command.operation === "set_end_item"
                ? items.setEndItem(true)
                : command.operation === "clear_end_item"
                ? items.clearEndItem()
                : command.operation === "view_rendition_id"
                ? items.viewRenditionById(command.id ?? "")
                : command.operation === "view_rendition_supplied_id"
                ? items.viewRenditionBySuppliedId(command.id ?? "")
                : command.operation === "view_default_rendition"
                ? items.viewDefaultRendition()
                : command.operation === "clear_rendition"
                ? items.clearRendition()
                : command.operation === "view_representation"
                ? items.viewRepresentation(command.id ?? "entire-part")
                : items.clearRepresentation();
            }
            const items = op.where((query) =>
              query.withMetadata(
                command.query.metadata.filter,
                command.query.metadata.keys,
                false
              )
            );
            return command.type === "set_phantom"
              ? items.setPhantom(command.phantom)
              : command.visible
              ? items.show()
              : items.hide();
          })
          .execute();
      }
      return { commandId, ok: true };
    } catch (error) {
      return {
        commandId,
        ok: false,
        error: {
          code: "VIEWER_COMMAND_FAILED",
          message:
            error instanceof Error ? error.message : "Viewer command failed.",
        },
      };
    }
  }
}
