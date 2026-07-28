import { PartQuery, ViewerCommand } from "./viewer-command";

const MaxFilterLength = 120;

export function validatePartQuery(
  query: PartQuery,
  availableKeys: readonly string[]
): string | undefined {
  if (
    query.metadata.filter.trim().length === 0 ||
    query.metadata.filter.length > MaxFilterLength
  ) {
    return "The metadata filter must be between 1 and 120 characters.";
  }
  const allowed = new Set([...availableKeys, "Name", "VERTEX_SCENE_ITEM_NAME"]);
  if (
    query.metadata.keys.length === 0 ||
    !query.metadata.keys.every((key) => allowed.has(key))
  ) {
    return "That metadata key is not enabled for AI viewer actions.";
  }
  return undefined;
}

export function normalizeViewerCommand(
  command: ViewerCommand,
  availableKeys: readonly string[]
): ViewerCommand {
  if (command.type === "scene_transaction") {
    const allowed = new Set([
      ...availableKeys,
      "Name",
      "VERTEX_SCENE_ITEM_NAME",
    ]);
    return {
      ...command,
      steps: command.steps.map((step) =>
        step.query == null
          ? step
          : {
              ...step,
              query: {
                ...step.query,
                metadata: {
                  ...step.query.metadata,
                  keys: step.query.metadata.keys.filter((key) =>
                    allowed.has(key)
                  ),
                },
              },
            }
      ),
    };
  }
  if (
    command.type === "reset_view" ||
    command.type === "scene_tree_action" ||
    (command.type === "scene_action" && command.target !== "metadata")
  ) {
    return command;
  }
  if (command.query == null) return command;
  const query = command.query;
  const allowed = [...availableKeys, "Name", "VERTEX_SCENE_ITEM_NAME"];
  const keys = query.metadata.keys
    .map((key) => {
      const matchingKey = allowed.find(
        (allowedKey) =>
          allowedKey.toLocaleLowerCase() === key.trim().toLocaleLowerCase()
      );
      if (matchingKey != null) return matchingKey;
      return key.trim().toLocaleLowerCase() === "part name" &&
        allowed.includes("Name")
        ? "Name"
        : undefined;
    })
    .filter((key): key is string => key != null);
  return {
    ...command,
    query: { ...query, metadata: { ...query.metadata, keys } },
  };
}

export function validateViewerCommand(
  command: ViewerCommand,
  availableKeys: readonly string[]
): string | undefined {
  if (command.type === "reset_view") return undefined;
  if (command.type === "scene_tree_action") return undefined;
  if (command.type === "scene_transaction") {
    return command.steps
      .filter((step) => step.target === "metadata" && step.query != null)
      .map((step) => validatePartQuery(step.query as PartQuery, availableKeys))
      .find((violation) => violation != null);
  }
  if (command.type === "scene_action") {
    return command.target === "metadata" && command.query != null
      ? validatePartQuery(command.query, availableKeys)
      : undefined;
  }
  return validatePartQuery(command.query, availableKeys);
}

export function requiresConfirmation(command: ViewerCommand): boolean {
  return command.type !== "reset_view" || command.scope !== "camera";
}
