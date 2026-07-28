import { randomUUID } from "crypto";
import { NextApiResponse } from "next";

import {
  isViewerCommand,
  PartQuery,
  ViewerCommand,
  ViewerContext,
} from "../../lib/ai/viewer-command";
import {
  normalizeViewerCommand,
  requiresConfirmation,
  validateViewerCommand,
} from "../../lib/ai/viewer-policy";
import { getViewerSdkTypings } from "../../lib/ai/viewer-sdk-typings";
import withSession, { NextIronRequest, TokenKey } from "../../lib/with-session";

type AgentRequest = {
  readonly message?: string;
  readonly context?: ViewerContext;
};
type AgentResponse = {
  readonly message: string;
  readonly command?: ViewerCommand;
  readonly commandId?: string;
  readonly commands?: ViewerCommand[];
  readonly commandIds?: string[];
  readonly requiresConfirmation?: boolean;
};

const ToolDefinitions = [
  {
    name: "fly_to_parts",
    description:
      "Use for 'fly to this part', 'focus on these parts', or equivalent requests. It shows only the selected or resolved target and fits the camera to that visible result. Use selected when 'this part' refers to the current selection; otherwise use metadata with a non-exact filter.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["target"],
      properties: {
        target: {
          type: "string",
          enum: ["root", "selected", "visible", "metadata"],
        },
        key: { type: "string" },
        filter: { type: "string" },
      },
    },
  },
  {
    name: "reset_scene",
    description:
      "Reset the loaded scene to its default state. Use scope all for requests such as 'start over' or 'reset the scene'; use camera only when the user explicitly asks to reset the camera.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["scope"],
      properties: {
        scope: { type: "string", enum: ["camera", "overrides", "all"] },
      },
    },
  },
  {
    name: "scene_tree_action",
    description:
      "Operate the visible scene tree. Use expand_root for requests to expand the root node, collapse_root to collapse it, and expand_all/collapse_all for the whole tree.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["expand_root", "collapse_root", "expand_all", "collapse_all"],
        },
      },
    },
  },
  {
    name: "scene_transaction",
    description:
      "Atomically apply up to four show, hide, ghost, or unghost actions. Use this for compound requests such as ghost everything except the engine: ghost root, then unghost the metadata target.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["steps"],
      properties: {
        steps: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "target"],
            properties: {
              operation: {
                type: "string",
                enum: ["show", "hide", "ghost", "unghost"],
              },
              target: {
                type: "string",
                enum: ["root", "selected", "visible", "metadata"],
              },
              key: { type: "string" },
              filter: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "scene_action",
    description:
      "Apply a scene action. Use root for the root/all items, selected for current selection, and metadata only as a fallback using a key from SELECTED_METADATA_KEYS.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["operation", "target"],
      properties: {
        operation: {
          type: "string",
          enum: [
            "show",
            "show_only",
            "hide",
            "select",
            "deselect",
            "ghost",
            "unghost",
            "paint",
            "highlight",
            "clear_highlight",
            "transform",
            "clear_transforms",
            "set_end_item",
            "clear_end_item",
            "view_rendition_id",
            "view_rendition_supplied_id",
            "view_default_rendition",
            "clear_rendition",
            "view_representation",
            "clear_representation",
          ],
        },
        target: {
          type: "string",
          enum: ["root", "selected", "visible", "metadata"],
        },
        key: { type: "string" },
        filter: { type: "string" },
        color: {
          type: "string",
          description:
            "Required for paint. Use a six-digit hex color such as #ff0000. Convert ordinary color names (red, green, blue, orange, purple, etc.) to their hex value before calling this tool.",
        },
        id: { type: "string" },
        transform: { type: "array", items: { type: "number" } },
      },
    },
  },
  {
    name: "ghost_parts",
    description:
      "Ghost parts matching an approved metadata filter. This is a reversible visual operation.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["key", "filter"],
      properties: {
        key: { type: "string" },
        filter: { type: "string" },
      },
    },
  },
  {
    name: "set_visibility",
    description:
      "Show or hide parts matching an approved metadata filter. This is a reversible visual operation.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["key", "filter", "visible"],
      properties: {
        key: { type: "string" },
        filter: { type: "string" },
        visible: { type: "boolean" },
      },
    },
  },
];

export default withSession(async function handler(
  req: NextIronRequest,
  res: NextApiResponse<AgentResponse | { readonly message: string }>
): Promise<void> {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed." });
  if (req.session.get(TokenKey) == null)
    return res.status(401).json({ message: "Authentication required." });
  const body = parseBody(req.body);
  if (
    body == null ||
    typeof body.message !== "string" ||
    body.message.trim() === "" ||
    body.message.length > 2000 ||
    !validContext(body.context)
  ) {
    return res.status(400).json({ message: "Invalid AI viewer request." });
  }
  const provider = process.env.AGENT?.toLocaleLowerCase() ?? "claude";
  if (provider !== "claude" && provider !== "openai") {
    return res.status(500).json({ message: "AGENT must be claude or openai." });
  }
  if (provider === "claude" && !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      message:
        "AI viewer is not configured. Set ANTHROPIC_API_KEY on the server.",
    });
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      message: "AI viewer is not configured. Set OPENAI_API_KEY on the server.",
    });
  }

  const deterministicCommand =
    sequentialVisibilityCommand(body.message) ??
    compoundVisibilityCommand(body.message);
  if (deterministicCommand != null) {
    const availableKeys = body.context.metadataKeys ?? [];
    const normalizedCommand = normalizeViewerCommand(
      deterministicCommand,
      availableKeys
    );
    const violation = validateViewerCommand(normalizedCommand, availableKeys);
    if (violation != null) return res.status(400).json({ message: violation });
    return res.status(200).json({
      message: withQuerySummary(
        "I prepared a compound viewer action for the scene and its exception.",
        [normalizedCommand]
      ),
      command: normalizedCommand,
      commandId: randomUUID(),
      requiresConfirmation: requiresConfirmation(normalizedCommand),
    });
  }

  try {
    const availableKeys = body.context.metadataKeys ?? [];
    const candidateKeys =
      body.context.metadataCandidates != null &&
      body.context.metadataCandidates.length > 0
        ? body.context.metadataCandidates.slice(0, 25)
        : availableKeys;
    // The browser has already narrowed the scene's columns to request-relevant
    // candidates. Use that complete bounded set for every metadata selector;
    // a second model pass was both costly and prone to dropping useful keys.
    const selectedMetadataKeys = candidateKeys;
    const sdkTypings = await getViewerSdkTypings();
    const system = `You are a safe assistant for a 3D viewer. Use a tool for ghost/show/hide requests. Never claim an action happened: say it is ready for confirmation. Answer metadata questions only from CURRENT_SELECTION. Do not invent metadata or item counts. For metadata requests, use only SELECTED_METADATA_KEYS. They are the complete, request-specific set of client-filtered candidate columns; query across all of them rather than choosing only one, and prefer a semantically relevant key rather than defaulting to a name key. Use fly_to_parts for any “fly to” or “focus on” request: it shows only the selected/resolved target and fits the camera to it. Use reset_scene with scope all when the user says “start over,” “reset the scene,” or otherwise asks to return the viewer to its default state. For paint, color, or colour requests, call scene_action with operation paint and a #RRGGBB color. Convert basic color names yourself (for example red=#ff0000, green=#008000, blue=#0000ff); users may also supply a hex value. When a request contains independent actions, emit one semantic tool call for each action in the order requested. For example, “show everything and then expand the root node” requires a scene_action show/root call followed by a scene_tree_action expand_root call. The complete installed SDK typings below are reference context, not permission to emit raw SDK calls. Only emit the semantic tools provided to you.\n\n${sdkTypings}`;
    const user = `CURRENT_SELECTION: ${JSON.stringify(
      body.context.selection
    )}\nSELECTED_METADATA_KEYS: ${JSON.stringify(
      selectedMetadataKeys
    )}\nSEARCH_HINTS: ${JSON.stringify(
      body.context.searchHints ?? []
    )}\n\nUSER_REQUEST: ${body.message}`;
    const completion = await fetch(
      provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: (provider === "openai"
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            }
          : {
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01",
              "x-api-key": process.env.ANTHROPIC_API_KEY,
            }) as Record<string, string>,
        body: JSON.stringify(
          provider === "openai"
            ? {
                model: process.env.OPENAI_VIEWER_MODEL || "gpt-4.1-mini",
                temperature: 0,
                tools: ToolDefinitions.map((tool) => ({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema,
                  },
                })),
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: user },
                ],
              }
            : {
                model:
                  process.env.CLAUDE_VIEWER_MODEL ||
                  "claude-sonnet-4-5-20250929",
                max_tokens: 600,
                temperature: 0,
                tools: ToolDefinitions,
                system,
                messages: [
                  {
                    role: "user",
                    content: user,
                  },
                ],
              }
        ),
      }
    );
    if (!completion.ok)
      throw new Error(
        `Provider request failed (${completion.status}): ${(
          await completion.text()
        ).slice(0, 300)}`
      );
    const payload = (await completion.json()) as
      | ClaudeResponse
      | OpenAiResponse;
    const openAiMessage =
      provider === "openai"
        ? (payload as OpenAiResponse).choices?.[0]?.message
        : undefined;
    const toolUses =
      provider === "openai"
        ? (openAiMessage?.tool_calls ?? []).map((toolCall) => ({
            type: "tool_use" as const,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          }))
        : (payload as ClaudeResponse).content?.filter(isToolUse) ?? [];
    const text =
      openAiMessage?.content ??
      (payload as ClaudeResponse).content?.find(isText)?.text;
    const commands = toolUses
      .map((toolUse) =>
        commandFromTool(
          toolUse,
          body.context?.searchHints ?? [],
          selectedMetadataKeys
        )
      )
      .filter((command): command is ViewerCommand => command != null);
    if (commands.length > 0) {
      const normalizedCommands = commands.map((command) =>
        normalizeViewerCommand(command, availableKeys)
      );
      const violation = normalizedCommands
        .map((command) => validateViewerCommand(command, availableKeys))
        .find((candidate) => candidate != null);
      if (violation != null)
        return res.status(400).json({ message: violation });
      const executionCommands = combineCompatibleCommands(normalizedCommands);
      const commandIds = executionCommands.map(() => randomUUID());
      return res.status(200).json({
        message: withQuerySummary(
          text || "I prepared a reversible viewer action.",
          executionCommands
        ),
        command: executionCommands[0],
        commandId: commandIds[0],
        commands: executionCommands,
        commandIds,
        requiresConfirmation: executionCommands.some(requiresConfirmation),
      });
    }
    return res
      .status(200)
      .json({ message: text || "I could not complete that request." });
  } catch (error) {
    console.error("AI viewer request failed", {
      sceneId: body.context.sceneId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(502).json({
      message: "The AI viewer service is unavailable. Please try again.",
    });
  }
});

function parseBody(body: unknown): AgentRequest | undefined {
  if (typeof body !== "string") return body as AgentRequest | undefined;
  try {
    return JSON.parse(body) as AgentRequest;
  } catch {
    return undefined;
  }
}

function validContext(
  context: ViewerContext | undefined
): context is ViewerContext {
  return (
    context != null &&
    typeof context.sceneId === "string" &&
    context.sceneId.length > 0 &&
    typeof context.selection === "object" &&
    typeof context.selection.metadata === "object"
  );
}

function commandFromTool(
  tool: ClaudeToolUse | undefined,
  searchHints: readonly string[],
  selectedMetadataKeys: readonly string[]
): ViewerCommand | undefined {
  if (tool == null) return undefined;
  const fallbackFilter = searchHints[searchHints.length - 1] ?? "";
  const args = tool.input as {
    operation?:
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
      | "clear_representation"
      | "expand_root"
      | "collapse_root"
      | "expand_all"
      | "collapse_all";
    target?: "root" | "selected" | "visible" | "metadata";
    key?: string;
    filter?: string;
    visible?: boolean;
    color?: string;
    id?: string;
    transform?: number[];
    scope?: "camera" | "overrides" | "all";
    steps?: Array<{
      operation?: "show" | "hide" | "ghost" | "unghost";
      target?: "root" | "selected" | "visible" | "metadata";
      key?: string;
      filter?: string;
    }>;
  };
  const query = {
    metadata: {
      keys: Array.from(
        new Set([
          args.key ?? "",
          ...selectedMetadataKeys,
          "Name",
          "VERTEX_SCENE_ITEM_NAME",
        ])
      ),
      filter: args.filter?.trim() || fallbackFilter,
      exactMatch: false,
    },
  };
  const command: unknown =
    tool.name === "fly_to_parts"
      ? {
          version: 1,
          type: "scene_action",
          operation: "show_only",
          target: args.target,
          query: args.target === "metadata" ? query : undefined,
        }
      : tool.name === "reset_scene"
      ? { version: 1, type: "reset_view", scope: args.scope }
      : tool.name === "scene_tree_action"
      ? { version: 1, type: "scene_tree_action", operation: args.operation }
      : tool.name === "scene_transaction"
      ? {
          version: 1,
          type: "scene_transaction",
          steps: args.steps?.map((step) => ({
            operation: step.operation,
            target: step.target,
            query:
              step.target === "metadata"
                ? {
                    metadata: {
                      keys: Array.from(
                        new Set([
                          step.key ?? "",
                          ...selectedMetadataKeys,
                          "Name",
                          "VERTEX_SCENE_ITEM_NAME",
                        ])
                      ),
                      filter: step.filter?.trim() || fallbackFilter,
                      exactMatch: false,
                    },
                  }
                : undefined,
          })),
        }
      : tool.name === "scene_action"
      ? {
          version: 1,
          type: "scene_action",
          operation: args.operation,
          target: args.target,
          color: normalizeMaterialColor(args.color),
          id: args.id,
          transform: args.transform,
          query: args.target === "metadata" ? query : undefined,
        }
      : tool.name === "ghost_parts"
      ? { version: 1, type: "set_phantom", query, phantom: true }
      : tool.name === "set_visibility"
      ? { version: 1, type: "set_visibility", query, visible: args.visible }
      : undefined;
  return isViewerCommand(command) ? command : undefined;
}

function withQuerySummary(
  message: string,
  commands: readonly ViewerCommand[]
): string {
  const summaries = commands.flatMap(describeCommandQueries);
  const uniqueSummaries = Array.from(new Set(summaries));
  return uniqueSummaries.length === 0
    ? message
    : `${message}\n\nQuery used: ${uniqueSummaries.join("; ")}.`;
}

function describeCommandQueries(command: ViewerCommand): string[] {
  if (command.type === "scene_tree_action") {
    return [
      command.operation === "expand_root" ||
      command.operation === "collapse_root"
        ? "scene-tree root-node query"
        : "scene-tree all-nodes query",
    ];
  }
  if (command.type === "scene_transaction") {
    return command.steps.map((step) => describeTarget(step.target, step.query));
  }
  if (command.type === "scene_action") {
    return [describeTarget(command.target, command.query)];
  }
  if (command.type === "reset_view")
    return ["scene reset to its default state"];
  return [describeTarget("metadata", command.query)];
}

function describeTarget(
  target: "root" | "selected" | "visible" | "metadata",
  query?: {
    readonly metadata: { readonly keys: string[]; readonly filter: string };
  }
): string {
  if (target === "root") return "root query (all scene items)";
  if (target === "selected") return "current-selection query";
  if (target === "visible") return "visible-items query";
  if (query == null) return "metadata query";
  const visibleKeys = query.metadata.keys.slice(0, 3);
  const remainingKeys = query.metadata.keys.length - visibleKeys.length;
  return `metadata query for “${
    query.metadata.filter
  }” using ${visibleKeys.join(", ")}${
    remainingKeys > 0 ? `, and ${remainingKeys} more` : ""
  }`;
}

function normalizeMaterialColor(color: string | undefined): string | undefined {
  if (color == null) return undefined;
  const value = color.trim().toLocaleLowerCase();
  const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex != null) {
    return `#${
      hex.length === 3
        ? hex
            .split("")
            .map((character) => `${character}${character}`)
            .join("")
        : hex
    }`;
  }
  return BasicMaterialColors[value];
}

function compoundVisibilityCommand(request: string): ViewerCommand | undefined {
  const match = request.match(
    /^\s*(ghost|unghost|hide|show)\s+(?:all|everything|the entire (?:scene|model))\s+(?:besides?|besdies|except(?:\s+for)?|without|but\s+not)\s+(?:the\s+)?(.+?)\s*[.!?]*\s*$/i
  );
  if (match == null) return undefined;
  const operation = match[1].toLocaleLowerCase() as
    | "ghost"
    | "unghost"
    | "hide"
    | "show";
  const filters = match[2]
    .split(/\s*(?:,|\band\b)\s*/i)
    .map((filter) => filter.replace(/^the\s+/i, "").trim())
    .filter((filter) => filter.length > 0);
  // A scene transaction is capped at four steps: the root operation plus up
  // to three independently resolved exceptions.
  if (filters.length === 0 || filters.length > 3) return undefined;
  const inverse: typeof operation =
    operation === "ghost"
      ? "unghost"
      : operation === "unghost"
      ? "ghost"
      : operation === "hide"
      ? "show"
      : "hide";
  return {
    version: 1,
    type: "scene_transaction",
    steps: [
      { operation, target: "root" },
      ...filters.map((filter) => ({
        operation: inverse,
        target: "metadata" as const,
        query: {
          metadata: {
            keys: ["Name", "VERTEX_SCENE_ITEM_NAME"],
            filter,
            exactMatch: false,
          },
        },
      })),
    ],
  };
}

function sequentialVisibilityCommand(
  request: string
): ViewerCommand | undefined {
  const clauses = request
    .split(/\s*,?\s+and then\s+/i)
    .map((clause) => clause.trim().replace(/[.!?]+$/, ""));
  if (clauses.length < 2 || clauses.length > 4) return undefined;
  const steps = clauses.map((clause) => {
    const match = clause.match(
      /^(show|hide|ghost|unghost)\s+(?:(all|everything|the entire (?:scene|model))|(?:the\s+)?(.+))$/i
    );
    if (match == null) return undefined;
    const operation = match[1].toLocaleLowerCase() as
      | "show"
      | "hide"
      | "ghost"
      | "unghost";
    if (match[2] != null) return { operation, target: "root" as const };
    const filter = match[3]?.trim();
    if (filter == null || filter.length === 0) return undefined;
    return {
      operation,
      target: "metadata" as const,
      query: {
        metadata: {
          keys: ["Name", "VERTEX_SCENE_ITEM_NAME"],
          filter,
          exactMatch: false,
        },
      },
    };
  });
  return steps.some((step) => step == null)
    ? undefined
    : {
        version: 1,
        type: "scene_transaction",
        steps: steps as Array<{
          operation: "show" | "hide" | "ghost" | "unghost";
          target: "root" | "metadata";
          query?: {
            metadata: {
              keys: string[];
              filter: string;
              exactMatch: boolean;
            };
          };
        }>,
      };
}

type TransactionStep = {
  readonly operation: "show" | "hide" | "ghost" | "unghost";
  readonly target: "root" | "selected" | "visible" | "metadata";
  readonly query?: PartQuery;
};

function combineCompatibleCommands(
  commands: readonly ViewerCommand[]
): ViewerCommand[] {
  const result: ViewerCommand[] = [];
  let pendingSteps: TransactionStep[] = [];
  const flush = (): void => {
    if (pendingSteps.length === 1) {
      const [step] = pendingSteps;
      result.push({
        version: 1,
        type: "scene_action",
        operation: step.operation,
        target: step.target,
        query: step.query,
      });
    } else if (pendingSteps.length > 1) {
      result.push({
        version: 1,
        type: "scene_transaction",
        steps: pendingSteps,
      });
    }
    pendingSteps = [];
  };
  for (const command of commands) {
    const step = toTransactionStep(command);
    if (step == null) {
      flush();
      result.push(command);
    } else {
      pendingSteps.push(step);
      if (pendingSteps.length === 4) flush();
    }
  }
  flush();
  return result;
}

function toTransactionStep(
  command: ViewerCommand
): TransactionStep | undefined {
  if (command.type !== "scene_action") return undefined;
  if (
    command.operation !== "show" &&
    command.operation !== "hide" &&
    command.operation !== "ghost" &&
    command.operation !== "unghost"
  ) {
    return undefined;
  }
  return {
    operation: command.operation,
    target: command.target,
    query: command.query,
  };
}

const BasicMaterialColors: Record<string, string> = {
  aqua: "#00ffff",
  beige: "#f5f5dc",
  black: "#000000",
  blue: "#0000ff",
  brown: "#a52a2a",
  cyan: "#00ffff",
  fuchsia: "#ff00ff",
  gold: "#ffd700",
  gray: "#808080",
  green: "#008000",
  grey: "#808080",
  lime: "#00ff00",
  magenta: "#ff00ff",
  maroon: "#800000",
  navy: "#000080",
  olive: "#808000",
  orange: "#ffa500",
  pink: "#ffc0cb",
  purple: "#800080",
  red: "#ff0000",
  silver: "#c0c0c0",
  teal: "#008080",
  white: "#ffffff",
  yellow: "#ffff00",
};

type ClaudeToolUse = {
  readonly type: "tool_use";
  readonly name: string;
  readonly input: unknown;
};
type ClaudeText = { readonly type: "text"; readonly text: string };
type ClaudeResponse = { readonly content?: Array<ClaudeToolUse | ClaudeText> };
type OpenAiResponse = {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: string;
      readonly tool_calls?: Array<{
        readonly function: {
          readonly name: string;
          readonly arguments: string;
        };
      }>;
    };
  }>;
};
function isToolUse(
  content: ClaudeToolUse | ClaudeText
): content is ClaudeToolUse {
  return content.type === "tool_use";
}
function isText(content: ClaudeToolUse | ClaudeText): content is ClaudeText {
  return content.type === "text";
}
