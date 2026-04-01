import { useDisplay } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { TaskGrid } from "./TaskGrid";

function renderSamplingValue(value: string | undefined) {
  return value && value.trim() ? value : <em>(not provided)</em>;
}

export function DetailPanel() {
  const { displayContent } = useDisplay();

  if (displayContent.type === "idle") {
    return (
      <div className="detail-panel detail-panel--empty">
        <p className="detail-placeholder">
          Select a resource, tool, or prompt on the left to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      {displayContent.type === "loading" && (
        <div className="loading">
          <span className="spinner" />
          {displayContent.label}
        </div>
      )}

      {displayContent.type === "error" && (
        <div className="error">{displayContent.message}</div>
      )}

      {displayContent.type === "grid" && (
        <TaskGrid
          key={displayContent.key}
          rows={displayContent.rows}
          postAction={displayContent.postAction}
        />
      )}

      {displayContent.type === "text" && (
        <>
          {displayContent.postAction && (
            <p className="post-action">{displayContent.postAction}</p>
          )}
          <pre className="tool-text-result">{displayContent.text}</pre>
        </>
      )}

      {displayContent.type === "mutated" && (
        <div className="call-result">
          {displayContent.sampling && (
            <section className="sampling-result">
              <p className="sampling-result__eyebrow">
                {MCP_COPY.samplingResultTitle}
              </p>
              <p className="sampling-result__note">{MCP_COPY.samplingResultNote}</p>
              <div className="sampling-comparison-grid">
                <div className="sampling-comparison-card">
                  <h3>Original input</h3>
                  <dl>
                    <div>
                      <dt>Title</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.original.title)}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.original.description)}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.original.priority)}</dd>
                    </div>
                    <div>
                      <dt>Due date</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.original.dueDate)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="sampling-comparison-card">
                  <h3>Enriched result</h3>
                  <dl>
                    <div>
                      <dt>Title</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.enriched.title)}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.enriched.description)}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.enriched.priority)}</dd>
                    </div>
                    <div>
                      <dt>Due date</dt>
                      <dd>{renderSamplingValue(displayContent.sampling.enriched.dueDate)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>
          )}

          {displayContent.rows && displayContent.rows.length > 0 ? (
            <TaskGrid
              rows={displayContent.rows}
              postAction={displayContent.postAction}
            />
          ) : (
            <>
              {displayContent.postAction && (
                <p className="post-action">{displayContent.postAction}</p>
              )}
              {displayContent.text && (
                <pre className="tool-text-result">{displayContent.text}</pre>
              )}
            </>
          )}
          {!displayContent.sampling &&
            displayContent.text?.includes("Created task ") &&
            !displayContent.rows && (
              <p className="tool-refresh-hint">{MCP_COPY.samplingFallbackNote}</p>
            )}
        </div>
      )}
    </div>
  );
}
