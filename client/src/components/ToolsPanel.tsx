import { useState, useRef } from "react";
import { useMcp } from "../context/McpContext";
import { useDisplay } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { callTool } from "../mcp/client";
import type { Tool, ToolCallResult } from "../mcp/client";
import { parseMarkdownTable } from "../lib/parseMarkdownTable";

interface CallState {
  status: "idle" | "loading" | "error";
  error?: string;
}

function schemaSummary(tool: Tool): string {
  const props = tool.inputSchema?.properties;
  if (!props) return "No parameters";

  const required = new Set(tool.inputSchema.required ?? []);
  const parts = Object.entries(props).map(([name, schema]) => {
    const flag = required.has(name) ? "required" : "optional";
    return `${name} (${schema.type ?? "unknown"}, ${flag})`;
  });

  return parts.join(", ");
}

function getInputType(
  fieldName: string,
  schema: { type: string; description?: string; enum?: string[] }
): "text" | "date" | "select" {
  if (schema.enum && schema.enum.length > 0) return "select";
  if (fieldName.toLowerCase().includes("date")) return "date";
  return "text";
}

function renderField(
  name: string,
  schema: { type: string; description?: string; enum?: string[] },
  required: boolean,
  value: string,
  error: string | undefined,
  onChange: (val: string) => void
) {
  const inputType = getInputType(name, schema);
  const id = `field-${name}`;
  const isInvalid = !!error;

  return (
    <div key={name} className="tool-form-field">
      <label htmlFor={id}>
        {name}
        {!required && <span className="field-optional">(optional)</span>}
      </label>
      {inputType === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={isInvalid ? "input-invalid" : ""}
        >
          <option value="">— select —</option>
          {schema.enum!.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.description ?? name}
          className={isInvalid ? "input-invalid" : ""}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

const MUTATING_TOOLS = new Set(["create_task", "update_task"]);

export function ToolsPanel() {
  const { tools } = useMcp();
  const { setDisplayContent } = useDisplay();

  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  const submitSeqRef = useRef(0);

  function handleSelect(tool: Tool) {
    submitSeqRef.current++;
    setSelectedTool(tool);
    setFormValues({});
    setValidationErrors({});
    setCallState({ status: "idle" });
  }

  function handleFieldChange(name: string, value: string) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const required = new Set(selectedTool!.inputSchema.required ?? []);
    const errors: Record<string, string> = {};
    for (const name of required) {
      if (!formValues[name]?.trim()) {
        errors[name] = `${name} is required`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const args: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(formValues)) {
      if (value.trim() !== "") {
        args[name] = value.trim();
      }
    }

    const isMutating = MUTATING_TOOLS.has(selectedTool!.name);
    const seq = ++submitSeqRef.current;

    setCallState({ status: "loading" });
    setDisplayContent({ type: "loading", label: `Calling ${selectedTool!.name}…` });

    try {
      const result: ToolCallResult = await callTool(selectedTool!.name, args);

      if (seq !== submitSeqRef.current) return;

      const text = result.content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");

      if (result.isError) {
        setCallState({ status: "error", error: text || "Tool returned an error." });
        setDisplayContent({ type: "error", message: text || "Tool returned an error." });
        return;
      }

      setCallState({ status: "idle" });

      const rows = parseMarkdownTable(text);

      if (isMutating) {
        setDisplayContent({
          type: "mutated",
          text,
          rows: rows.length > 0 ? rows : undefined,
          postAction: MCP_COPY.postActionCall(selectedTool!.name),
        });
      } else if (rows.length > 0) {
        setDisplayContent({
          type: "grid",
          rows,
          postAction: MCP_COPY.postActionCall(selectedTool!.name),
        });
      } else {
        setDisplayContent({
          type: "text",
          text,
          postAction: MCP_COPY.postActionCall(selectedTool!.name),
        });
      }
    } catch (err) {
      if (seq !== submitSeqRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setCallState({ status: "error", error: message });
      setDisplayContent({ type: "error", message });
    }
  }

  function renderInlineForm(tool: Tool) {
    return (
      <form className="tool-form" onSubmit={handleSubmit} noValidate>
        {Object.entries(tool.inputSchema.properties ?? {}).map(([name, schema]) => {
          const required = new Set(tool.inputSchema.required ?? []);
          return renderField(
            name,
            schema,
            required.has(name),
            formValues[name] ?? "",
            validationErrors[name],
            (val) => handleFieldChange(name, val)
          );
        })}

        <button
          type="submit"
          className="submit-btn"
          disabled={callState.status === "loading"}
        >
          {callState.status === "loading" && <span className="spinner" />}
          {callState.status === "loading" ? "Calling…" : `Call ${tool.name}`}
        </button>

        {callState.status === "error" && (
          <div className="error">{callState.error}</div>
        )}
      </form>
    );
  }

  return (
    <section className="panel">
      <h2>Tools</h2>
      <p className="blurb">{MCP_COPY.toolsBlurb}</p>

      {tools.status === "loading" && (
        <div className="loading">
          <span className="spinner" />
          Loading tools…
        </div>
      )}

      {tools.status === "error" && (
        <div className="error">{tools.error}</div>
      )}

      {tools.status === "idle" && tools.data.length === 0 && (
        <p className="empty-state">No tools found.</p>
      )}

      {tools.data.length > 0 && (
        <div className="item-list">
          {tools.data.map((t) => (
            <div key={t.name} className="item-card-wrapper">
              <div
                className={`item-card${selectedTool?.name === t.name ? " item-card--selected" : ""}`}
                onClick={() => handleSelect(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(t);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <p className="item-name">{t.name}</p>
                {t.description && (
                  <p className="item-description">{t.description}</p>
                )}
                <p className="item-meta">
                  Parameters: <code>{schemaSummary(t)}</code>
                </p>
              </div>
              {selectedTool?.name === t.name && renderInlineForm(t)}
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
