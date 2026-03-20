import { useMcp } from "../context/McpContext";
import { MCP_COPY } from "../copy/mcpExplainer";

export function ResourcesPanel() {
  const { resources } = useMcp();

  return (
    <section className="panel">
      <h2>Resources</h2>
      <p className="blurb">{MCP_COPY.resourcesBlurb}</p>

      {resources.status === "loading" && (
        <div className="loading">
          <span className="spinner" />
          Loading resources…
        </div>
      )}

      {resources.status === "error" && (
        <div className="error">{resources.error}</div>
      )}

      {resources.status === "idle" && resources.data.length === 0 && (
        <p className="empty-state">No resources found.</p>
      )}

      {resources.data.length > 0 && (
        <div className="item-list">
          {resources.data.map((r) => (
            <div key={r.uri} className="item-card">
              <p className="item-name">{r.name}</p>
              <p className="item-uri">{r.uri}</p>
              {r.description && (
                <p className="item-description">{r.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
