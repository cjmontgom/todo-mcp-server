import { useDisplay } from "../context/DisplayContext";
import { TaskGrid } from "./TaskGrid";

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
        </div>
      )}
    </div>
  );
}
