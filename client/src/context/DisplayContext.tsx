import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GridRow } from "../lib/parseMarkdownTable";
import type { SamplingEnrichmentDetails } from "../lib/parseSamplingEnrichment";
import { respondToSamplingRequest } from "../mcp/client";

type ActiveTab = "manual" | "ai";

interface SamplingRequestMessage {
  role?: string;
  content?: unknown;
}

export interface PendingSamplingRequest {
  id: string | number;
  promptText: string;
  rawMessages: SamplingRequestMessage[];
  maxTokens?: number;
  startedAt: string;
  sourceMode: "manual";
}

interface SamplingPendingContent {
  type: "sampling-pending";
  request: PendingSamplingRequest;
}

interface SamplingOutcomeContent {
  type: "sampling-outcome";
  outcome: "cancelled" | "timeout";
  message: string;
}

export type DisplayContent =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "error"; message: string }
  | { type: "grid"; rows: GridRow[]; postAction?: string; key?: string }
  | { type: "text"; text: string; postAction?: string }
  | SamplingPendingContent
  | SamplingOutcomeContent
  | {
      type: "mutated";
      text?: string;
      rows?: GridRow[];
      postAction?: string;
      sampling?: SamplingEnrichmentDetails;
    };

interface DisplayState {
  activeTab: ActiveTab;
  displayContent: DisplayContent;
  setDisplayContent: (content: DisplayContent) => void;
  submitSamplingResponse: (requestId: string | number, text: string) => Promise<void>;
  cancelSamplingResponse: (requestId: string | number) => Promise<void>;
}

const DisplayContext = createContext<DisplayState | null>(null);

function normalizeSamplingMessages(raw: unknown): SamplingRequestMessage[] {
  return Array.isArray(raw) ? (raw as SamplingRequestMessage[]) : [];
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  const typed = content as { type?: string; text?: unknown };
  if (typed.type === "text" && typeof typed.text === "string") return typed.text;
  return "";
}

function extractPromptText(messages: SamplingRequestMessage[]): string {
  const parts = messages
    .map((message) => messageContentToText(message.content))
    .filter((text) => text.trim().length > 0);
  return parts.join("\n\n");
}

function samplingKey(id: string | number): string {
  return String(id);
}

const SAMPLING_TIMEOUT_MESSAGE = "The sampling request expired. Try calling the tool again.";
const SAMPLING_CANCELLED_MESSAGE =
  "Sampling cancelled - no task was created. The server received an error response.";

export function DisplayProvider({
  activeTab,
  children,
}: {
  activeTab: ActiveTab;
  children: ReactNode;
}) {
  const [displayContent, setDisplayContent] = useState<DisplayContent>({ type: "idle" });
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const pendingByIdRef = useRef<Map<string, PendingSamplingRequest>>(new Map());
  const activePendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const proxyUrl = import.meta.env.VITE_MCP_PROXY_URL as string | undefined;
    if (!proxyUrl) return;

    const eventSource = new EventSource(`${proxyUrl}/sse`);

    eventSource.onmessage = (evt) => {
      let payload: unknown;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object") return;
      const typed = payload as { type?: string };

      if (typed.type === "sampling-request") {
        if (activeTabRef.current !== "manual") return;
        const event = payload as {
          id?: string | number;
          messages?: unknown;
          maxTokens?: unknown;
        };
        if (event.id == null) return;
        const messages = normalizeSamplingMessages(event.messages);
        const request: PendingSamplingRequest = {
          id: event.id,
          promptText: extractPromptText(messages),
          rawMessages: messages,
          maxTokens: typeof event.maxTokens === "number" ? event.maxTokens : undefined,
          startedAt: new Date().toISOString(),
          sourceMode: "manual",
        };
        const key = samplingKey(request.id);
        pendingByIdRef.current.set(key, request);
        activePendingIdRef.current = key;
        const next: SamplingPendingContent = { type: "sampling-pending", request };
        setDisplayContent(next);
        return;
      }

      if (typed.type === "sampling-request-error") {
        const event = payload as { id?: string | number; error?: unknown };
        if (event.id == null) return;
        const key = samplingKey(event.id);
        const hadPendingRequest = pendingByIdRef.current.delete(key);
        const detail = typeof event.error === "string" ? event.error.toLowerCase() : "";
        if (detail.includes("timed out") && hadPendingRequest && activePendingIdRef.current === key) {
          activePendingIdRef.current = null;
          const next: SamplingOutcomeContent = {
            type: "sampling-outcome",
            outcome: "timeout",
            message: SAMPLING_TIMEOUT_MESSAGE,
          };
          if (activeTabRef.current === "manual") {
            setDisplayContent(next);
          }
        }
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  async function submitSamplingResponse(requestId: string | number, text: string): Promise<void> {
    const key = samplingKey(requestId);
    const request = pendingByIdRef.current.get(key);
    if (!request) {
      throw new Error("Sampling request not found or already resolved.");
    }

    await respondToSamplingRequest({
      id: request.id,
      response: {
        role: "assistant",
        model: "manual-human",
        content: { type: "text", text },
      },
    });

    pendingByIdRef.current.delete(key);
    if (activePendingIdRef.current === key) {
      activePendingIdRef.current = null;
    }
  }

  async function cancelSamplingResponse(requestId: string | number): Promise<void> {
    const key = samplingKey(requestId);
    const request = pendingByIdRef.current.get(key);
    if (!request) {
      throw new Error("Sampling request not found or already resolved.");
    }

    await respondToSamplingRequest({
      id: request.id,
      response: {
        role: "assistant",
        model: "manual-human",
        content: { type: "unsupported-cancel-intent" },
      },
    });

    pendingByIdRef.current.delete(key);
    if (activePendingIdRef.current === key) {
      activePendingIdRef.current = null;
    }
    const next: SamplingOutcomeContent = {
      type: "sampling-outcome",
      outcome: "cancelled",
      message: SAMPLING_CANCELLED_MESSAGE,
    };
    if (activeTabRef.current === "manual") {
      setDisplayContent(next);
    }
  }

  const value = useMemo(
    () => ({
      activeTab,
      displayContent,
      setDisplayContent,
      submitSamplingResponse,
      cancelSamplingResponse,
    }),
    [activeTab, displayContent]
  );

  return (
    <DisplayContext.Provider value={value}>
      {children}
    </DisplayContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDisplay(): DisplayState {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error("useDisplay must be used within DisplayProvider");
  return ctx;
}
