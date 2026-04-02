import { useEffect, useState } from "react";
import { useDisplay } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { TaskGrid } from "./TaskGrid";

function renderSamplingValue(value: string | undefined) {
  return value && value.trim() ? value : <em>(not provided)</em>;
}

export function DetailPanel() {
  const {
    activeTab,
    displayContent,
    submitSamplingResponse,
    cancelSamplingResponse,
  } = useDisplay();
  const [responseDraft, setResponseDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pendingRequestId =
    displayContent.type === "sampling-pending" ? displayContent.request.id : null;

  useEffect(() => {
    if (pendingRequestId == null) {
      setResponseDraft("");
      setFormError(null);
      setIsSubmitting(false);
      setIsCancelling(false);
      return;
    }
    const template = JSON.stringify(
      {
        title: "...",
        description: "...",
        priority: "medium",
        dueDate: "YYYY-MM-DD",
      },
      null,
      2
    );
    setResponseDraft(template);
    setFormError(null);
    setIsSubmitting(false);
    setIsCancelling(false);
  }, [pendingRequestId]);

  if (
    activeTab === "ai" &&
    (displayContent.type === "sampling-pending" || displayContent.type === "sampling-outcome")
  ) {
    return (
      <div className="detail-panel detail-panel--empty">
        <p className="detail-placeholder">
          Select a resource, tool, or prompt on the left to see results here.
        </p>
      </div>
    );
  }

  if (displayContent.type === "idle") {
    return (
      <div className="detail-panel detail-panel--empty">
        <p className="detail-placeholder">
          Select a resource, tool, or prompt on the left to see results here.
        </p>
      </div>
    );
  }

  async function handleSamplingSubmit() {
    if (displayContent.type !== "sampling-pending" || isSubmitting || isCancelling) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseDraft);
    } catch {
      setFormError("Response must be valid JSON.");
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setFormError("Response must be a JSON object.");
      return;
    }

    const typed = parsed as Record<string, unknown>;
    if (!["title", "description", "priority", "dueDate"].some((field) => field in typed)) {
      setFormError("Include at least one of: title, description, priority, dueDate.");
      return;
    }

    if (
      "priority" in typed &&
      typed.priority !== "low" &&
      typed.priority !== "medium" &&
      typed.priority !== "high"
    ) {
      setFormError("priority must be one of: low, medium, high.");
      return;
    }

    if ("dueDate" in typed && typeof typed.dueDate === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(typed.dueDate)) {
        setFormError("dueDate must use YYYY-MM-DD format.");
        return;
      }
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await submitSamplingResponse(displayContent.request.id, responseDraft);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSamplingCancel() {
    if (displayContent.type !== "sampling-pending" || isSubmitting || isCancelling) {
      return;
    }
    setFormError(null);
    setIsCancelling(true);
    try {
      await cancelSamplingResponse(displayContent.request.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCancelling(false);
    }
  }

  function renderSamplingEducation() {
    return (
      <div className="sampling-education">
        <section className="sampling-education-section">
          <h3>{MCP_COPY.samplingTitle}</h3>
          <p>{MCP_COPY.samplingExplanation}</p>
        </section>
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

      {displayContent.type === "sampling-pending" && (
        <section className="sampling-request">
          <p className="sampling-result__eyebrow">Sampling Request</p>
          <p className="sampling-result__note">{MCP_COPY.samplingManualRequestNote}</p>
          <pre className="tool-text-result sampling-request__prompt">
            {displayContent.request.promptText || "(No prompt text provided by server.)"}
          </pre>
          <label className="sampling-request__label" htmlFor="sampling-response-json">
            Response JSON
          </label>
          <textarea
            id="sampling-response-json"
            className="sampling-request__textarea"
            value={responseDraft}
            onChange={(e) => setResponseDraft(e.target.value)}
            disabled={isSubmitting || isCancelling}
            spellCheck={false}
          />
          <div className="sampling-request__actions">
            <button
              type="button"
              className="submit-btn"
              onClick={handleSamplingSubmit}
              disabled={isSubmitting || isCancelling}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              className="sampling-cancel-btn"
              onClick={handleSamplingCancel}
              disabled={isSubmitting || isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </button>
          </div>
          {formError && <div className="error">{formError}</div>}
          {renderSamplingEducation()}
        </section>
      )}

      {displayContent.type === "sampling-outcome" && (
        <section className="sampling-request">
          <p className="sampling-result__eyebrow">Sampling Request</p>
          <p className="sampling-result__note">{displayContent.message}</p>
          {renderSamplingEducation()}
        </section>
      )}

      {displayContent.type === "mutated" && (
        <div className="call-result">
          {displayContent.sampling && (
            <section className="sampling-result">
              <p className="sampling-result__eyebrow">
                {MCP_COPY.samplingResultTitle}
              </p>
              <p className="sampling-result__note">{MCP_COPY.samplingResultNote}</p>
              <p className="sampling-result__note">{MCP_COPY.samplingManualAnsweredNote}</p>
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
              {renderSamplingEducation()}
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
