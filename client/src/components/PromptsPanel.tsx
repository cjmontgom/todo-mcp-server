import { useState, useRef } from "react";
import { useMcp } from "../context/McpContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { getPrompt } from "../mcp/client";
import type { Prompt } from "../mcp/client";
import { TaskGrid } from "./TaskGrid";
import { parseMarkdownTable } from "../lib/parseMarkdownTable";
import type { GridRow } from "../lib/parseMarkdownTable";

interface InvokeState {
  status: "idle" | "loading" | "error" | "success";
  text?: string;
  rows?: GridRow[];
  error?: string;
  isPureTable?: boolean;
}

function argumentsSummary(prompt: Prompt): string | null {
  if (!prompt.arguments || prompt.arguments.length === 0) return null;

  return prompt.arguments
    .map((a) => {
      const flag = a.required ? "required" : "optional";
      const desc = a.description ? ` — ${a.description}` : "";
      return `${a.name} (${flag}${desc})`;
    })
    .join(", ");
}

function renderArgField(
  arg: { name: string; description?: string; required?: boolean },
  value: string,
  error: string | undefined,
  onChange: (val: string) => void
) {
  const id = `arg-${arg.name}`;
  return (
    <div key={arg.name} className="tool-form-field">
      <label htmlFor={id}>
        {arg.name}
        {!arg.required && <span className="field-optional">(optional)</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={arg.description ?? arg.name}
        className={error ? "input-invalid" : ""}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function PromptsPanel() {
  const { prompts } = useMcp();

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [argErrors, setArgErrors] = useState<Record<string, string>>({});
  const [invokeState, setInvokeState] = useState<InvokeState>({ status: "idle" });
  const submitSeqRef = useRef(0);

  function handleSelect(prompt: Prompt) {
    submitSeqRef.current++;
    setSelectedPrompt(prompt);
    setArgValues({});
    setArgErrors({});
    setInvokeState({ status: "idle" });
  }

  function handleArgChange(name: string, value: string) {
    setArgValues((prev) => ({ ...prev, [name]: value }));
    if (argErrors[name]) {
      setArgErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleInvoke(e: React.FormEvent) {
    e.preventDefault();

    const requiredArgs = (selectedPrompt!.arguments ?? []).filter((a) => a.required);
    const errors: Record<string, string> = {};
    for (const arg of requiredArgs) {
      if (!argValues[arg.name]?.trim()) {
        errors[arg.name] = `${arg.name} is required`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setArgErrors(errors);
      return;
    }

    const args: Record<string, string> = {};
    for (const [name, value] of Object.entries(argValues)) {
      if (value.trim() !== "") {
        args[name] = value.trim();
      }
    }

    const seq = ++submitSeqRef.current;
    setInvokeState({ status: "loading" });

    try {
      const result = await getPrompt(selectedPrompt!.name, args);

      if (seq !== submitSeqRef.current) return;

      const text = result.messages
        .filter((m) => m.content.type === "text")
        .map((m) => m.content.text ?? "")
        .join("\n");

      const rows = parseMarkdownTable(text);
      const hasTaskData = rows.some((r) => r.id || r.title);
      const isPureTable = text.trimStart().startsWith("|");

      setInvokeState({
        status: "success",
        text,
        rows: hasTaskData ? rows : undefined,
        isPureTable,
      });
    } catch (err) {
      if (seq !== submitSeqRef.current) return;
      setInvokeState({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section className="panel">
      <h2>Prompts</h2>
      <p className="blurb">{MCP_COPY.promptsBlurb}</p>

      {prompts.status === "loading" && (
        <div className="loading">
          <span className="spinner" />
          Loading prompts…
        </div>
      )}

      {prompts.status === "error" && (
        <div className="error">{prompts.error}</div>
      )}

      {prompts.status === "idle" && prompts.data.length === 0 && (
        <p className="empty-state">No prompts found.</p>
      )}

      {prompts.data.length > 0 && (
        <div className="item-list">
          {prompts.data.map((p) => {
            const summary = argumentsSummary(p);
            return (
              <div
                key={p.name}
                className={`item-card${selectedPrompt?.name === p.name ? " item-card--selected" : ""}`}
                onClick={() => handleSelect(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(p);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <p className="item-name">{p.name}</p>
                {p.description && (
                  <p className="item-description">{p.description}</p>
                )}
                {summary && (
                  <p className="item-meta">
                    Arguments: <code>{summary}</code>
                  </p>
                )}
                {(!p.arguments || p.arguments.length === 0) && (
                  <p className="item-meta">No arguments</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {prompts.status === "idle" && prompts.data.length > 0 && (
        <p className="post-action">{MCP_COPY.postActionListPrompts}</p>
      )}

      {selectedPrompt !== null && (
        <form className="tool-form" onSubmit={handleInvoke} noValidate>
          {(!selectedPrompt.arguments || selectedPrompt.arguments.length === 0) ? (
            <p className="item-meta">{MCP_COPY.promptNoArgs}</p>
          ) : (
            selectedPrompt.arguments.map((arg) =>
              renderArgField(
                arg,
                argValues[arg.name] ?? "",
                argErrors[arg.name],
                (val) => handleArgChange(arg.name, val)
              )
            )
          )}
          <button
            type="submit"
            className="submit-btn"
            disabled={invokeState.status === "loading"}
          >
            {invokeState.status === "loading" && <span className="spinner" />}
            {invokeState.status === "loading" ? "Invoking…" : `Invoke ${selectedPrompt.name}`}
          </button>
        </form>
      )}

      {(invokeState.status === "error" || invokeState.status === "success") && (
        <div className="call-result">
          {invokeState.status === "error" && (
            <div className="error">{invokeState.error}</div>
          )}
          {invokeState.status === "success" && (
            <>
              {invokeState.isPureTable && invokeState.rows && invokeState.rows.length > 0 ? (
                <TaskGrid
                  rows={invokeState.rows}
                  note={MCP_COPY.gridNotePrompt}
                  postAction={MCP_COPY.postActionInvoke(selectedPrompt!.name)}
                />
              ) : (
                <>
                  <p className="post-action">
                    {MCP_COPY.postActionInvoke(selectedPrompt!.name)}
                  </p>
                  {invokeState.rows && invokeState.rows.length > 0 && (
                    <TaskGrid
                      rows={invokeState.rows}
                      note={MCP_COPY.gridNotePrompt}
                    />
                  )}
                  {invokeState.text && (
                    <pre className="tool-text-result">{invokeState.text}</pre>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
