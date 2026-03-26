import { useState, useRef, useEffect } from "react";
import { useDisplay } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { interpretMessage, type ChatMessage } from "../mcp/client";
import {
  parseMarkdownTable,
  parseJsonTaskArray,
} from "../lib/parseMarkdownTable";

export interface ChatMessageDisplay {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessageDisplay[];
  onMessagesChange: (msgs: ChatMessageDisplay[]) => void;
}

export function ChatPanel({ messages, onMessagesChange }: ChatPanelProps) {
  const { setDisplayContent } = useDisplay();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessageDisplay = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    onMessagesChange(updated);
    setInputValue("");
    setIsLoading(true);

    const history: ChatMessage[] = updated
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await interpretMessage(trimmed, history);

      const educationalNote = getEducationalNote(result.operation);
      const content = educationalNote
        ? `${result.explanation}\n\n${educationalNote}`
        : result.explanation;

      const assistantMsg: ChatMessageDisplay = {
        role: "assistant",
        content,
      };
      onMessagesChange([...updated, assistantMsg]);

      displayMcpResult(result);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err);
      const isOllamaDown =
        errorText.includes("LLM provider unreachable") ||
        errorText.includes("ECONNREFUSED");
      const content = isOllamaDown
        ? `${errorText}\n\n${MCP_COPY.ollamaSetupHint}`
        : errorText;

      onMessagesChange([
        ...updated,
        { role: "assistant", content, error: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function getEducationalNote(operation: {
    type: string;
    params: Record<string, unknown>;
  }): string | null {
    if (operation.type === "resource_read") {
      return MCP_COPY.postActionAiRead(operation.params.uri as string);
    }
    if (operation.type === "tool_call") {
      return MCP_COPY.postActionAiCall(operation.params.name as string);
    }
    if (operation.type === "prompt_get") {
      return MCP_COPY.postActionAiInvoke(operation.params.name as string);
    }
    return null;
  }

  function displayMcpResult(result: {
    operation: { type: string; params: Record<string, unknown> };
    mcpResult: unknown;
  }) {
    const { operation, mcpResult } = result;
    const mcpResponse = mcpResult as { result?: Record<string, unknown> };
    const innerResult = mcpResponse?.result ?? mcpResult;

    if (operation.type === "resource_read") {
      const uri = operation.params.uri as string;
      const postAction = MCP_COPY.postActionAiRead(uri);
      const contents = (innerResult as { contents?: Array<{ text: string; mimeType: string }> })?.contents;
      if (contents && contents.length > 0) {
        const content = contents[0];
        const mimeType = (content.mimeType ?? "").split(";")[0].trim();

        if (mimeType === "application/json") {
          const rows = parseJsonTaskArray(content.text);
          if (rows.length > 0) {
            setDisplayContent({ type: "grid", rows, postAction, key: `ai-${Date.now()}` });
            return;
          }
        }

        const rows = parseMarkdownTable(content.text);
        if (rows.length > 0) {
          setDisplayContent({ type: "grid", rows, postAction, key: `ai-${Date.now()}` });
          return;
        }

        setDisplayContent({ type: "text", text: content.text, postAction });
        return;
      }

      setDisplayContent({ type: "text", text: JSON.stringify(innerResult, null, 2), postAction });
    } else if (operation.type === "tool_call") {
      const toolName = operation.params.name as string;
      const postAction = MCP_COPY.postActionAiCall(toolName);
      const toolResult = innerResult as { content?: Array<{ text?: string }>; isError?: boolean };
      const text = toolResult?.content?.[0]?.text ?? JSON.stringify(innerResult, null, 2);

      const rows = parseMarkdownTable(text);
      if (rows.length > 0) {
        setDisplayContent({ type: "mutated", rows, postAction });
        return;
      }
      const jsonRows = parseJsonTaskArray(text);
      if (jsonRows.length > 0) {
        setDisplayContent({ type: "mutated", rows: jsonRows, postAction });
        return;
      }
      setDisplayContent({ type: "mutated", text, postAction });
    } else if (operation.type === "prompt_get") {
      const promptName = operation.params.name as string;
      const postAction = MCP_COPY.postActionAiInvoke(promptName);
      const promptResult = innerResult as { messages?: Array<{ content: { text?: string } }> };
      const text = promptResult?.messages?.[0]?.content?.text ?? JSON.stringify(innerResult, null, 2);

      const rows = parseMarkdownTable(text);
      if (rows.length > 0) {
        setDisplayContent({ type: "grid", rows, postAction, key: `ai-${Date.now()}` });
        return;
      }
      setDisplayContent({ type: "text", text, postAction });
    } else {
      setDisplayContent({
        type: "text",
        text: JSON.stringify(innerResult, null, 2),
        postAction: "",
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <section className="chat-panel">
      <p className="blurb">{MCP_COPY.chatBlurb}</p>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message chat-message--${msg.role}${msg.error ? " chat-message--error" : ""}`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message chat-message--assistant chat-typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. show me all high priority tasks"
          disabled={isLoading}
        />
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </div>
    </section>
  );
}
