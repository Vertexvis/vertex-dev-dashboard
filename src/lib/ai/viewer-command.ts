export const ViewerCommandVersion = 1 as const;

export type PartQuery = {
  readonly metadata: {
    readonly keys: string[];
    readonly filter: string;
    readonly exactMatch?: boolean;
  };
};

export type ViewerCommand =
  | {
      readonly version: 1;
      readonly type: "scene_tree_action";
      readonly operation:
        | "expand_root"
        | "collapse_root"
        | "expand_all"
        | "collapse_all";
    }
  | {
      readonly version: 1;
      readonly type: "scene_transaction";
      readonly steps: Array<{
        readonly operation: "show" | "hide" | "ghost" | "unghost";
        readonly target: "root" | "selected" | "visible" | "metadata";
        readonly query?: PartQuery;
      }>;
    }
  | {
      readonly version: 1;
      readonly type: "scene_action";
      readonly operation:
        | "show"
        | "show_only"
        | "hide"
        | "select"
        | "deselect"
        | "ghost"
        | "unghost"
        | "paint"
        | "highlight"
        | "clear_highlight"
        | "transform"
        | "clear_transforms"
        | "set_end_item"
        | "clear_end_item"
        | "view_rendition_id"
        | "view_rendition_supplied_id"
        | "view_default_rendition"
        | "clear_rendition"
        | "view_representation"
        | "clear_representation";
      readonly target: "root" | "selected" | "visible" | "metadata";
      readonly color?: string;
      readonly id?: string;
      readonly transform?: number[];
      readonly query?: PartQuery;
    }
  | {
      readonly version: 1;
      readonly type: "set_phantom";
      readonly query: PartQuery;
      readonly phantom: boolean;
    }
  | {
      readonly version: 1;
      readonly type: "set_visibility";
      readonly query: PartQuery;
      readonly visible: boolean;
    }
  | {
      readonly version: 1;
      readonly type: "reset_view";
      readonly scope: "camera" | "overrides" | "all";
    };

export type ViewerCommandResult = {
  readonly commandId: string;
  readonly ok: boolean;
  readonly affectedCount?: number;
  readonly correlationId?: string;
  readonly error?: { readonly code: string; readonly message: string };
};

export type ViewerContext = {
  readonly sceneId: string;
  readonly metadataKeys?: string[];
  readonly metadataCandidates?: string[];
  readonly searchHints?: string[];
  readonly selection: {
    readonly itemId?: string;
    readonly metadata: Record<string, string>;
  };
};

export function isViewerCommand(value: unknown): value is ViewerCommand {
  if (value == null || typeof value !== "object") return false;
  const command = value as {
    readonly version?: unknown;
    readonly type?: unknown;
    readonly query?: unknown;
    readonly phantom?: unknown;
    readonly visible?: unknown;
    readonly scope?: unknown;
    readonly operation?: unknown;
    readonly target?: unknown;
    readonly steps?: unknown;
    readonly color?: unknown;
  };
  if (command.version !== ViewerCommandVersion) return false;
  if (command.type === "reset_view") {
    return (
      command.scope === "camera" ||
      command.scope === "overrides" ||
      command.scope === "all"
    );
  }
  if (command.type === "scene_tree_action") {
    return (
      command.operation === "expand_root" ||
      command.operation === "collapse_root" ||
      command.operation === "expand_all" ||
      command.operation === "collapse_all"
    );
  }
  if (command.type === "scene_action") {
    return (
      (command.operation === "show" ||
        command.operation === "show_only" ||
        command.operation === "hide" ||
        command.operation === "select" ||
        command.operation === "deselect" ||
        command.operation === "ghost" ||
        command.operation === "unghost" ||
        command.operation === "paint" ||
        command.operation === "highlight" ||
        command.operation === "clear_highlight" ||
        command.operation === "transform" ||
        command.operation === "clear_transforms" ||
        command.operation === "set_end_item" ||
        command.operation === "clear_end_item" ||
        command.operation === "view_rendition_id" ||
        command.operation === "view_rendition_supplied_id" ||
        command.operation === "view_default_rendition" ||
        command.operation === "clear_rendition" ||
        command.operation === "view_representation" ||
        command.operation === "clear_representation") &&
      (command.target === "root" ||
        command.target === "selected" ||
        command.target === "visible" ||
        command.target === "metadata") &&
      (command.target !== "metadata" || command.query != null) &&
      (command.operation !== "paint" ||
        (typeof command.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(command.color)))
    );
  }
  if (command.type === "scene_transaction") {
    return (
      Array.isArray(command.steps) &&
      command.steps.length > 0 &&
      command.steps.length <= 4
    );
  }
  if (command.type !== "set_phantom" && command.type !== "set_visibility")
    return false;
  const query = command.query as { readonly metadata?: unknown } | undefined;
  const metadata = query?.metadata as
    | { readonly keys?: unknown; readonly filter?: unknown }
    | undefined;
  const validQuery =
    query != null &&
    typeof query === "object" &&
    metadata != null &&
    Array.isArray(metadata.keys) &&
    metadata.keys.every((key) => typeof key === "string") &&
    typeof metadata.filter === "string";
  return command.type === "set_phantom"
    ? validQuery && typeof command.phantom === "boolean"
    : validQuery && typeof command.visible === "boolean";
}

/**
 * Produces a command that reverses a safely reversible viewer operation while
 * retaining its original target/query. Commands which would overwrite unknown
 * prior viewer state intentionally return undefined.
 */
export function invertViewerCommand(
  command: ViewerCommand
): ViewerCommand | undefined {
  const inverseOperation = (operation: string): string | undefined => {
    switch (operation) {
      case "show":
        return "hide";
      case "hide":
        return "show";
      case "ghost":
        return "unghost";
      case "unghost":
        return "ghost";
      case "select":
        return "deselect";
      case "deselect":
        return "select";
      case "set_end_item":
        return "clear_end_item";
      case "clear_end_item":
        return "set_end_item";
      case "expand_root":
        return "collapse_root";
      case "collapse_root":
        return "expand_root";
      case "expand_all":
        return "collapse_all";
      case "collapse_all":
        return "expand_all";
      default:
        return undefined;
    }
  };

  if (command.type === "scene_tree_action") {
    const operation = inverseOperation(command.operation);
    return operation == null
      ? undefined
      : { ...command, operation: operation as typeof command.operation };
  }
  if (command.type === "scene_transaction") {
    const steps = command.steps
      .slice()
      .reverse()
      .map((step) => {
        const operation = inverseOperation(step.operation);
        return operation == null
          ? undefined
          : { ...step, operation: operation as typeof step.operation };
      });
    return steps.some((step) => step == null)
      ? undefined
      : { ...command, steps: steps as typeof command.steps };
  }
  if (command.type === "scene_action") {
    const operation = inverseOperation(command.operation);
    return operation == null
      ? undefined
      : { ...command, operation: operation as typeof command.operation };
  }
  if (command.type === "set_phantom") {
    return { ...command, phantom: !command.phantom };
  }
  if (command.type === "set_visibility") {
    return { ...command, visible: !command.visible };
  }
  return undefined;
}
