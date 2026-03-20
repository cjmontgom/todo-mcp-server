import { useMcp } from "../context/McpContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import type { Tool } from "../mcp/client";

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

export function ToolsPanel() {
  const { tools } = useMcp();

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
            <div key={t.name} className="item-card">
              <p className="item-name">{t.name}</p>
              {t.description && (
                <p className="item-description">{t.description}</p>
              )}
              <p className="item-meta">
                Parameters: <code>{schemaSummary(t)}</code>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
