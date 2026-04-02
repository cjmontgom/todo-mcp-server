import { useEffect, useState } from "react";
import { useDisplay, type SamplingTraceStep } from "../context/DisplayContext";
import { MCP_COPY } from "../copy/mcpExplainer";
import { parseSamplingEnrichment } from "../lib/parseSamplingEnrichment";
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

  function extractEnrichmentText(step: SamplingTraceStep): string {
    if (!step.data?.result) return "";
    const mcpResp = step.data.result as { result?: { content?: Array<{ text?: string }> } };
    const inner = mcpResp?.result ?? (step.data.result as { content?: Array<{ text?: string }> });
    return (inner as { content?: Array<{ text?: string }> })?.content?.[0]?.text ?? "";
  }

  function renderTraceStep(step: SamplingTraceStep, index: number, total: number) {
    const isLast = index === total - 1;

    const stepConfig: Record<
      SamplingTraceStep["step"],
      { label: string; annotation: string }[]
    > = {
      "server-requested": [
        { label: "The AI called create_task_using_sampling", annotation: MCP_COPY.samplingTraceStep1 },
        { label: "Server sent sampling/createMessage", annotation: MCP_COPY.samplingTraceStep2 },
      ],
      "calling-ollama": [
        { label: `Proxy called LLM${step.data?.model ? ` (${step.data.model})` : ""}`, annotation: MCP_COPY.samplingTraceStep3 },
      ],
      "ollama-responded": [
        { label: "LLM responded", annotation: MCP_COPY.samplingTraceStep4 },
      ],
      "enrichment-applied": [
        { label: "Enrichment applied", annotation: MCP_COPY.samplingTraceStep5 },
        { label: "Task created", annotation: MCP_COPY.samplingTraceStep6 },
      ],
    };

    const uiSteps = stepConfig[step.step] ?? [];

    return uiSteps.map((ui, uiIdx) => {
      const globalIdx = getStepOffset(step.step) + uiIdx;
      const stepNum = globalIdx + 1;
      const isAbsoluteLast = isLast && uiIdx === uiSteps.length - 1;

      return (
        <div key={`${step.step}-${uiIdx}`} className="sampling-trace__step">
          {!isAbsoluteLast && <span className="sampling-trace__connector" />}
          <div className="sampling-trace__number">{stepNum}</div>
          <div className="sampling-trace__content">
            <p className="sampling-trace__label">{ui.label}</p>
            <p className="sampling-trace__annotation">{ui.annotation}</p>
            {step.step === "calling-ollama" && uiIdx === 0 && step.data?.model && (
              <p className="sampling-trace__data">
                Model: <span className="sampling-trace__model">{step.data.model}</span>
              </p>
            )}
            {step.step === "ollama-responded" && uiIdx === 0 && step.data?.text && (
              <details className="sampling-trace__raw-json">
                <summary>Show raw response</summary>
                <pre className="sampling-trace__raw-pre">{step.data.text}</pre>
              </details>
            )}
            {step.step === "enrichment-applied" && uiIdx === 0 && (() => {
              const text = extractEnrichmentText(step);
              const enrichment = text
                ? parseSamplingEnrichment(text, { title: "", description: "", priority: "", dueDate: "" })
                : null;
              if (!enrichment) return null;
              return (
                <div className="sampling-trace__field-list">
                  {enrichment.changedFields.map((field) => (
                    <div key={field} className="sampling-trace__field-change">
                      <span className="sampling-trace__field-name">{field}</span>
                      <span className="sampling-trace__field-original">
                        {enrichment.original[field as keyof typeof enrichment.original] || "(none)"}
                      </span>
                      <span>→</span>
                      <span className="sampling-trace__field-enriched">
                        {enrichment.enriched[field as keyof typeof enrichment.enriched] || "(none)"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {step.step === "enrichment-applied" && uiIdx === 1 && (() => {
              const text = extractEnrichmentText(step);
              const enrichment = text
                ? parseSamplingEnrichment(text, { title: "", description: "", priority: "", dueDate: "" })
                : null;
              const title = enrichment?.enriched.title || "(unknown)";
              return (
                <p className="sampling-trace__task-title">{title}</p>
              );
            })()}
          </div>
        </div>
      );
    });
  }

  function getStepOffset(step: SamplingTraceStep["step"]): number {
    const offsets: Record<SamplingTraceStep["step"], number> = {
      "server-requested": 0,
      "calling-ollama": 2,
      "ollama-responded": 3,
      "enrichment-applied": 4,
    };
    return offsets[step] ?? 0;
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

      {displayContent.type === "sampling-preview" && (
        <section className="sampling-trace sampling-trace--preview">
          <p className="sampling-trace__eyebrow">{MCP_COPY.samplingTraceTitle}</p>
          {renderSamplingEducation()}
        </section>
      )}

      {displayContent.type === "sampling-trace" && (
        <section className="sampling-trace">
          <p className="sampling-trace__eyebrow">{MCP_COPY.samplingTraceTitle}</p>
          <div className="sampling-trace__steps">
            {displayContent.steps.map((step, i) =>
              renderTraceStep(step, i, displayContent.steps.length)
            )}
          </div>
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
