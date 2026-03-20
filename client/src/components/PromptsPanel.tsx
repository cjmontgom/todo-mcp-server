import { useMcp } from "../context/McpContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import type { Prompt } from "../mcp/client";

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

export function PromptsPanel() {
  const { prompts } = useMcp();

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
              <div key={p.name} className="item-card">
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
    </section>
  );
}
