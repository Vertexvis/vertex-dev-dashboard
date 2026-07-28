import {
  MicOutlined,
  PersonOutlined,
  SendOutlined,
  SmartToyOutlined,
  StopOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";

import { ViewerAgentBridge } from "../../lib/ai/viewer-agent-bridge";
import {
  invertViewerCommand,
  ViewerCommand,
  ViewerContext,
} from "../../lib/ai/viewer-command";
import { Metadata } from "../../lib/metadata";

interface Props {
  readonly sceneId: string;
  readonly selectedItemId?: string;
  readonly metadata?: Metadata;
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
  readonly loadedTree?: ViewerContext["loadedTree"];
}

type AgentResponse = {
  readonly message: string;
  readonly command?: ViewerCommand;
  readonly commandId?: string;
  readonly commands?: ViewerCommand[];
  readonly commandIds?: string[];
  readonly requiresConfirmation?: boolean;
};

export function AiViewerAssistant({
  sceneId,
  selectedItemId,
  metadata,
  viewer,
  loadedTree,
}: Props): JSX.Element {
  const [message, setMessage] = React.useState("");
  const [messages, setMessages] = React.useState<
    Array<{ readonly role: "user" | "assistant"; readonly text: string }>
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognition | undefined>();
  const undoStackRef = React.useRef<ViewerCommand[]>([]);
  const latestMessageRef = React.useRef<HTMLDivElement>(null);
  const starterSuggestion = treeSuggestion(loadedTree, selectedItemId != null);

  React.useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  React.useEffect(() => {
    undoStackRef.current = [];
  }, [sceneId]);

  React.useEffect(() => {
    latestMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  function toggleListening(): void {
    if (recognitionRef.current != null) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition == null) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Speech recognition is not supported by this browser.",
        },
      ]);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("");
      setMessage(transcript.trim());
    };
    recognition.onend = () => {
      recognitionRef.current = undefined;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = undefined;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  async function ask(): Promise<void> {
    if (message.trim() === "") return;
    setLoading(true);
    const userMessage = message.trim();
    setMessages((current) => [...current, { role: "user", text: userMessage }]);
    setMessage("");
    try {
      if (isUndoRequest(userMessage)) {
        await undoLastAction();
        return;
      }
      const sceneTree = document.querySelector(
        "#vertex-scene-tree"
      ) as HTMLVertexSceneTreeElement | null;
      const metadataKeys = await sceneTree?.fetchMetadataKeys();
      const context: ViewerContext = {
        sceneId,
        metadataKeys,
        metadataCandidates: filterMetadataKeys(metadataKeys ?? [], userMessage),
        searchHints: toSearchHints(userMessage),
        loadedTree,
        selection: {
          itemId: selectedItemId,
          metadata: Object.entries(metadata?.properties ?? {}).reduce<
            Record<string, string>
          >((result, [key, value]) => {
            if (value != null) result[key] = value;
            return result;
          }, {}),
        },
      };
      const response = await fetch("/api/ai-viewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, context }),
      });
      const body = (await response.json()) as AgentResponse;
      if (!response.ok) throw new Error(body.message);
      if (
        body.commands != null &&
        body.commandIds != null &&
        body.commands.length === body.commandIds.length
      ) {
        await executeCommands(body.commandIds, body.commands, body.message);
      } else if (body.command && body.commandId) {
        await executeCommand(body.commandId, body.command, body.message, true);
      } else {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: body.message },
        ]);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Unable to contact the AI viewer service.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function executeCommand(
    commandId: string,
    command: ViewerCommand,
    explanation: string,
    recordForUndo = false,
    reportResult = true
  ): Promise<boolean> {
    if (!viewer.current) {
      if (reportResult) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: "The viewer is not ready to run that action.",
          },
        ]);
      }
      return false;
    }
    const result = await new ViewerAgentBridge(viewer.current).execute(
      commandId,
      command
    );
    if (reportResult) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.ok
            ? `${explanation} Viewer action completed.`
            : result.error?.message ?? "Viewer action failed.",
        },
      ]);
    }
    if (result.ok && recordForUndo && invertViewerCommand(command) != null) {
      undoStackRef.current.push(command);
    }
    return result.ok;
  }

  async function executeCommands(
    commandIds: readonly string[],
    commands: readonly ViewerCommand[],
    explanation: string
  ): Promise<void> {
    const executeNext = async (index: number): Promise<boolean[]> => {
      if (index === commands.length) return [];
      const result = await executeCommand(
        commandIds[index],
        commands[index],
        explanation,
        true,
        false
      );
      return [result, ...(await executeNext(index + 1))];
    };
    const results = await executeNext(0);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: results.every(Boolean)
          ? `${explanation} Viewer actions completed.`
          : "Some viewer actions could not be completed.",
      },
    ]);
  }

  async function undoLastAction(): Promise<void> {
    const previousCommand = undoStackRef.current.at(-1);
    const inverse =
      previousCommand == null
        ? undefined
        : invertViewerCommand(previousCommand);
    if (inverse == null) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "There is no reversible viewer action to undo.",
        },
      ]);
      return;
    }
    const didUndo = await executeCommand(
      crypto.randomUUID(),
      inverse,
      "I reversed the previous viewer action.",
      false
    );
    if (didUndo) {
      // The inverse is now the latest applied action. Keeping it lets a
      // repeated “undo that” reverse the undo (for example hide → show → hide).
      undoStackRef.current[undoStackRef.current.length - 1] = inverse;
    }
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Gary — Your Vertex Assistant
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Ask about the model, or tell me what you want to see.
      </Typography>
      <Box sx={{ flexGrow: 1, overflowY: "auto", mb: 1 }}>
        {messages.length === 0 && (
          <Box sx={{ color: "text.secondary", mt: 2, textAlign: "center" }}>
            <SmartToyOutlined color="primary" />
            <Typography variant="body2">
              {starterSuggestion}
            </Typography>
          </Box>
        )}
        {messages.map((entry, index) => {
          const isUser = entry.role === "user";
          return (
            <Box
              key={index}
              sx={{
                alignItems: "flex-start",
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                gap: 0.75,
                mb: 1.25,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: isUser ? "primary.main" : "grey.200",
                  color: isUser ? "primary.contrastText" : "text.secondary",
                  height: 28,
                  width: 28,
                }}
              >
                {isUser ? (
                  <PersonOutlined fontSize="small" />
                ) : (
                  <SmartToyOutlined fontSize="small" />
                )}
              </Avatar>
              <Box
                role="status"
                sx={{
                  backgroundColor: isUser ? "primary.main" : "grey.100",
                  borderRadius: 2,
                  color: isUser ? "primary.contrastText" : "text.primary",
                  maxWidth: "80%",
                  px: 1.25,
                  py: 0.9,
                }}
              >
                {!isUser && (
                  <Typography
                    variant="caption"
                    sx={{ display: "block", fontWeight: 600, mb: 0.25 }}
                  >
                    Gary
                  </Typography>
                )}
                <Typography variant="body2">{entry.text}</Typography>
              </Box>
            </Box>
          );
        })}
        <Box ref={latestMessageRef} />
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          multiline
          maxRows={3}
          size="small"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder={inputPlaceholder(loadedTree)}
        />
        <IconButton
          aria-label={
            listening ? "Stop speech recognition" : "Start speech recognition"
          }
          color={listening ? "error" : "default"}
          onClick={toggleListening}
          disabled={loading}
        >
          {listening ? <StopOutlined /> : <MicOutlined />}
        </IconButton>
        <IconButton
          aria-label="Send AI viewer request"
          color="primary"
          onClick={() => void ask()}
          disabled={loading}
        >
          {loading ? <CircularProgress size={22} /> : <SendOutlined />}
        </IconButton>
      </Box>
    </Box>
  );
}

interface SpeechRecognitionResultEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function toSearchHints(request: string): string[] {
  const words = request.toLocaleLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
  return Array.from(
    new Set(
      words.flatMap((word) =>
        word.endsWith("ies")
          ? [word, `${word.slice(0, -3)}y`]
          : word.endsWith("s") && !word.endsWith("ss")
          ? [word, word.slice(0, -1)]
          : [word]
      )
    )
  ).slice(0, 10);
}

function treeSuggestion(
  loadedTree: ViewerContext["loadedTree"],
  hasSelection: boolean
): string {
  const itemName = loadedTree?.rows
    .map((row) => row.name?.trim())
    .find(
      (name): name is string =>
        name != null && name.length > 0 && name.length <= 60 && /[a-z]/i.test(name)
    );
  if (itemName != null) {
    return `Try “show only ${itemName}” or “ghost selected items.”`;
  }
  return hasSelection
    ? "Try “ghost selected items” or “show everything.”"
    : "Ask me to show, hide, ghost, or color parts in this model.";
}

function inputPlaceholder(loadedTree: ViewerContext["loadedTree"]): string {
  const itemName = loadedTree?.rows
    .map((row) => row.name?.trim())
    .find(
      (name): name is string =>
        name != null && name.length > 0 && name.length <= 60 && /[a-z]/i.test(name)
    );
  return itemName == null
    ? "Describe what you want to see"
    : `Show only ${itemName}`;
}

function filterMetadataKeys(
  metadataKeys: readonly string[],
  request: string
): string[] {
  const ignoredTerms = new Set([
    "all",
    "and",
    "besides",
    "everything",
    "except",
    "ghost",
    "hide",
    "only",
    "part",
    "parts",
    "show",
    "the",
    "then",
    "this",
    "unghost",
  ]);
  const requestTerms: string[] = Array.from(
    request.toLocaleLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? []
  ).filter((term) => !ignoredTerms.has(term));
  const usefulTerms = [
    "part",
    "name",
    "material",
    "assembly",
    "bom",
    "component",
    "description",
    "item",
    "type",
    "number",
    "revision",
    "rev",
  ];
  return metadataKeys
    .map((key) => {
      const normalized = key.toLocaleLowerCase();
      const requestScore = requestTerms.reduce(
        (score, term) => score + Number(normalized.includes(term)) * 10,
        0
      );
      const usefulScore = usefulTerms.reduce(
        (score, term) => score + Number(normalized.includes(term)),
        0
      );
      return { key, score: requestScore + usefulScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 25)
    .map(({ key }) => key);
}

function isUndoRequest(request: string): boolean {
  return /^(?:please\s+)?(?:undo|revert|reverse)(?:\s+(?:that|the last|last))?(?:\s+(?:change|action|command))?[.!?]*$/i.test(
    request.trim()
  );
}
