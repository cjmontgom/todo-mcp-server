# Story 7.6: Client — Ollama Sampling Trace in AI Tab, Remove Static SamplingPanel, Contextual Education

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner in the AI tab or reading about Sampling,
I want to see a live trace of the Ollama sampling flow and find educational explanations in context rather than in a static panel,
So that I understand the exact server→proxy→Ollama→server chain and learn at the moment of engagement.

## Acceptance Criteria

1. **AC1 — Sampling Trace block in DetailPanel when AI triggers `create_task_using_sampling`**
   Given Ollama triggers `create_task_using_sampling` (AI tab)
   When sampling completes
   Then the right-hand DetailPanel shows a Sampling Trace block with labelled, annotated steps:
   1. Server called `create_task_using_sampling`
   2. Server sent `sampling/createMessage` — _(the server requested an LLM completion from its client)_
   3. Proxy received the request and called Ollama _(model name shown)_
   4. Ollama responded _(raw JSON shown, collapsible)_
   5. Enrichment applied _(changed fields listed: original → enriched)_
   6. Task created: _{enriched title}_

2. **AC2 — Each trace step includes educational annotation**
   Given the Sampling Trace is shown
   When the learner reads each step
   Then each step includes a one-line educational annotation explaining the protocol action in plain English

3. **AC3 — SamplingPanel is confirmed absent**
   Given the standalone `SamplingPanel` component (added in Story 6.2) has already been removed from `App.tsx`
   When this story is implemented
   Then `SamplingPanel` is verified absent from `App.tsx` imports/rendering and no `SamplingPanel.tsx` component file exists
   And existing sampling copy keys in `mcpExplainer.ts` (`samplingTitle`, `samplingExplanation`, `samplingResultTitle`, `samplingResultNote`, etc.) remain available for reuse in contextual UI

4. **AC4 — Contextual sampling preview when `create_task_using_sampling` is selected in manual tab**
   Given `create_task_using_sampling` is selected in the Tools list (manual tab)
   When the tool card is selected but before the form is submitted
   Then the right-hand DetailPanel shows a contextual preview explaining the sampling flow that is about to happen, using existing `MCP_COPY` sampling strings
   And this preview replaces the generic "Select a resource, tool, or prompt" placeholder for this specific tool only

5. **AC5 — Build and tests remain green**
   Given the story is implemented
   When `npm run build` runs in `client/`
   Then TypeScript reports zero errors
   And relevant tests (new and existing) pass

## Tasks / Subtasks

- [x] Task 1: Subscribe to `sampling-trace` SSE events in DisplayContext (AC: #1)
  - [x] 1.1 Extend the `DisplayContent` union with a new `"sampling-trace"` type that accumulates trace steps (step name, annotation, timestamp, optional data like model name, raw response, changed fields).
  - [x] 1.2 In the existing `eventSource.onmessage` handler in `DisplayContext.tsx`, add a branch for `type === "sampling-trace"`. Accumulate steps into the trace state; do not replace previous steps — append each new step to the trace.
  - [x] 1.3 Only activate trace UI when `activeTab === "ai"` (mirror the tab-gating pattern used for `sampling-request` events in manual mode).
  - [x] 1.4 Handle the four proxy-emitted trace steps in order: `server-requested`, `calling-ollama`, `ollama-responded`, `enrichment-applied`. Extract relevant data from each (messages, model name, Ollama response text, enrichment result).
  - [x] 1.5 On `enrichment-applied`, parse the final MCP result to extract the created task title for the final "Task created" line.

- [x] Task 2: Render Sampling Trace block in DetailPanel (AC: #1, #2)
  - [x] 2.1 Add a new rendering branch in `DetailPanel.tsx` for `displayContent.type === "sampling-trace"`. Render a vertical step-by-step trace with numbered steps.
  - [x] 2.2 Each step shows: a label (e.g. "Server sent sampling/createMessage"), an educational annotation in italics (e.g. "the server requested an LLM completion from its client"), and optional data.
  - [x] 2.3 For `calling-ollama` step, show the model name (from `data.model`).
  - [x] 2.4 For `ollama-responded` step, show the raw JSON in a collapsible `<details>` element (collapsed by default).
  - [x] 2.5 For `enrichment-applied` step, parse the tool result text to show original→enriched field comparisons. Reuse `parseSamplingEnrichment` from `client/src/lib/parseSamplingEnrichment.ts` if applicable, otherwise extract from the enrichment result data.
  - [x] 2.6 Final step shows "Task created: {enriched title}" extracted from the tool result.
  - [x] 2.7 Show a heading/eyebrow like "Sampling Trace" and include `renderSamplingEducation()` at the bottom for contextual education.
  - [x] 2.8 Style the trace with a timeline/stepper visual treatment (e.g. numbered circles or vertical line connecting steps). Use CSS classes in `index.css`.

- [x] Task 3: Integrate trace with ChatPanel AI flow (AC: #1)
  - [x] 3.1 When `ChatPanel.displayMcpResult()` handles a `tool_call` for `create_task_using_sampling`, do NOT immediately overwrite `displayContent` with the final `mutated` result. Instead, let the trace events accumulate in `DisplayContext` and only finalize the display after `enrichment-applied` arrives.
  - [x] 3.2 Coordinate timing: the `enrichment-applied` SSE event arrives from the proxy after the MCP tool call resolves. ChatPanel receives the tool result via the `/llm/interpret` response; the trace events arrive asynchronously via SSE. Ensure both paths converge — the trace should show all steps, and the final result should also be accessible.
  - [x] 3.3 If no `sampling-trace` events are received (e.g. SSE disconnected), fall back to displaying the `mutated` result as before.

- [x] Task 4: Add contextual sampling preview for tool selection (AC: #4)
  - [x] 4.1 When `create_task_using_sampling` is selected in `ToolsPanel.handleSelect()`, call `setDisplayContent` with a new contextual preview content type (or reuse `"text"` type with sampling-specific copy).
  - [x] 4.2 The preview should explain: (a) this tool uses MCP Sampling, (b) the server will send a `sampling/createMessage` request, (c) in manual mode you will answer it yourself, (d) the enrichment result will show original vs enriched values.
  - [x] 4.3 Use existing `MCP_COPY.samplingTitle`, `MCP_COPY.samplingExplanation`, and related strings — do not hardcode new copy in JSX.
  - [x] 4.4 Only show the preview for `create_task_using_sampling`, not for other tools. Other tools should continue to show idle/placeholder state.

- [x] Task 5: Verify SamplingPanel absence (AC: #3)
  - [x] 5.1 Confirm no `SamplingPanel.tsx` file exists under `client/src/components/`.
  - [x] 5.2 Confirm `App.tsx` has no import or rendering of `SamplingPanel`.
  - [x] 5.3 Confirm `mcpExplainer.ts` retains all existing sampling copy keys (`samplingTitle`, `samplingExplanation`, `samplingResultTitle`, `samplingResultNote`, `samplingManualRequestNote`, `samplingManualAnsweredNote`, `samplingFallbackNote`, `postActionSamplingCall`).

- [x] Task 6: Add educational copy for trace steps (AC: #2)
  - [x] 6.1 Add new copy constants to `mcpExplainer.ts` for each trace step annotation:
    - `samplingTraceTitle`: heading for the trace block
    - `samplingTraceStep1`: annotation for "server called create_task_using_sampling"
    - `samplingTraceStep2`: annotation for "server sent sampling/createMessage"
    - `samplingTraceStep3`: annotation for "proxy called Ollama"
    - `samplingTraceStep4`: annotation for "Ollama responded"
    - `samplingTraceStep5`: annotation for "enrichment applied"
    - `samplingTraceStep6`: annotation for "task created"
    - `samplingPreviewNote`: contextual preview text for tool selection
  - [x] 6.2 All annotations should be concise (one line), use MCP terminology, and explain the protocol action in plain English.

- [x] Task 7: Tests and verification (AC: #5)
  - [x] 7.1 Add unit tests for SSE `sampling-trace` event parsing and accumulation in DisplayContext.
  - [x] 7.2 Add component tests for DetailPanel sampling trace rendering (steps appear in order, annotations visible, collapsible raw JSON).
  - [x] 7.3 Add test for contextual preview when `create_task_using_sampling` is selected.
  - [x] 7.4 Validate no regressions in existing manual sampling flow (sampling-pending, submit, cancel, timeout).
  - [x] 7.5 Validate no regressions in existing AI chat flow for non-sampling tools.
  - [x] 7.6 Run `cd client && npm run build` and `cd client && npm test`.

## Dev Notes

### Technical requirements (must follow)

- **Proxy SSE trace contract** (from Story 7.3, `proxy/src/index.ts`):
  - AI-mode sampling emits four SSE events via `broadcastSSE()`:
    1. `{ type: "sampling-trace", step: "server-requested", data: { id, messages, maxTokens } }`
    2. `{ type: "sampling-trace", step: "calling-ollama", data: { model: "llama3.1" } }`
    3. `{ type: "sampling-trace", step: "ollama-responded", data: { text: "..." } }`
    4. `{ type: "sampling-trace", step: "enrichment-applied", data: { result: { ... } } }` — emitted in the `/llm/interpret` handler after successful tool call
  - Events arrive asynchronously over the `/sse` EventSource endpoint
  - The `enrichment-applied` event is emitted from a different code path (the `/llm/interpret` handler at proxy line ~318) than the first three (the `bridge.on("serverRequest")` handler at proxy lines ~124-141)

- **Endpoint-based routing** remains unchanged:
  - Manual `/mcp` calls → human sampling mode (SSE `sampling-request` events)
  - AI `/llm/interpret` calls → AI sampling mode (SSE `sampling-trace` events)
  - These two paths are independent; do not mix trace UI into manual mode or vice versa

- **Do not modify proxy or server code** — this is a client-only story. Consume existing SSE events as-is.

### Architecture compliance

- All code changes stay in `client/` package
- Follow existing React + context + panel structure:
  - SSE subscription in `client/src/context/DisplayContext.tsx`
  - Rendering in `client/src/components/DetailPanel.tsx`
  - Tool selection in `client/src/components/ToolsPanel.tsx`
  - AI chat in `client/src/components/ChatPanel.tsx`
  - Copy in `client/src/copy/mcpExplainer.ts`
- Extend the `DisplayContent` union type — do NOT use a separate state mechanism for trace
- Preserve existing `sampling-pending`, `sampling-outcome`, and `mutated.sampling` display paths

### Library/framework requirements

- React + TypeScript patterns already in use are sufficient; no new dependencies needed
- Continue using `EventSource` for SSE subscription (already set up in `DisplayContext.tsx`)
- Use `<details>/<summary>` HTML elements for collapsible raw JSON — no accordion library needed
- Keep strict TypeScript typing for all new display state types

### File structure requirements

| File | Action |
|------|--------|
| `client/src/context/DisplayContext.tsx` | Add `sampling-trace` to DisplayContent union; add SSE handler for trace events; accumulate trace steps |
| `client/src/components/DetailPanel.tsx` | Add rendering for `sampling-trace` display type; add contextual preview for sampling tool selection |
| `client/src/components/ToolsPanel.tsx` | Set contextual preview `displayContent` when `create_task_using_sampling` is selected |
| `client/src/components/ChatPanel.tsx` | Coordinate `create_task_using_sampling` result with trace events; handle fallback if no trace arrives |
| `client/src/copy/mcpExplainer.ts` | Add trace step annotation strings and preview copy |
| `client/src/index.css` | Add CSS for sampling trace stepper/timeline visual treatment |

| File | Do NOT modify |
|------|---------------|
| `proxy/src/index.ts` | Trace event emission is already implemented |
| `proxy/src/sampling.ts` | AI sampling fulfillment unchanged |
| `src/index.ts` | Server tool logic out of scope |

### Key codebase facts for the dev agent

**Current DisplayContent union** (`client/src/context/DisplayContext.tsx` lines 41-55):
```typescript
export type DisplayContent =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "error"; message: string }
  | { type: "grid"; rows: GridRow[]; postAction?: string; key?: string }
  | { type: "text"; text: string; postAction?: string }
  | SamplingPendingContent
  | SamplingOutcomeContent
  | { type: "mutated"; text?: string; rows?: GridRow[]; postAction?: string; sampling?: SamplingEnrichmentDetails; };
```
Add a new `SamplingTraceContent` variant.

**Current SSE handler** (`DisplayContext.tsx` lines 116-170) handles `sampling-request` and `sampling-request-error` only. Add a third branch for `sampling-trace`.

**Current DetailPanel** (`DetailPanel.tsx`) has rendering branches for: `loading`, `error`, `grid`, `text`, `sampling-pending`, `sampling-outcome`, `mutated`. Add a new branch for `sampling-trace`.

**ChatPanel.displayMcpResult()** (`ChatPanel.tsx` lines 77-148) currently calls `setDisplayContent({ type: "mutated", ... })` for `tool_call` results. For `create_task_using_sampling`, need to coordinate with trace events arriving via SSE.

**ToolsPanel.handleSelect()** (`ToolsPanel.tsx` lines 96-102) currently resets form state but does NOT set `displayContent`. Add a call to `setDisplayContent` for `create_task_using_sampling` specifically.

**`parseSamplingEnrichment`** (`client/src/lib/parseSamplingEnrichment.ts`) parses the "enriched by AI" text format from tool results. Can be reused for the `enrichment-applied` trace step to extract field comparisons.

**Current sampling copy in mcpExplainer.ts** (all 44 lines):
- `samplingResultTitle`, `samplingResultNote` — enrichment section headers
- `samplingManualRequestNote` — manual HITL prompt
- `samplingManualAnsweredNote` — post-answer note
- `samplingTitle` — "What is Sampling?"
- `samplingExplanation` — detailed paragraph
- `samplingFallbackNote` — no enrichment detected
- `postActionSamplingCall(toolName)` — post-action string

**SamplingPanel status**: Already removed from `App.tsx` and no `SamplingPanel.tsx` file exists. This was done during Story 7.5 or earlier. AC3 is a verification step only.

### Timing/coordination challenge

The main complexity is **coordinating two async paths** when AI triggers `create_task_using_sampling`:
1. **SSE trace events** arrive incrementally via EventSource (`server-requested` → `calling-ollama` → `ollama-responded`)
2. **The tool result** arrives via the `POST /llm/interpret` HTTP response (processed in `ChatPanel.handleSubmit()`)
3. **`enrichment-applied`** arrives as a final SSE event after the tool call resolves

Recommended approach:
- When the first `sampling-trace` event arrives (while in AI tab), set `displayContent` to `{ type: "sampling-trace", steps: [...] }`
- Accumulate subsequent trace steps by appending to the array
- When `ChatPanel` receives the tool result for `create_task_using_sampling`, check if a trace is active. If so, enrich the trace with the final result data rather than overwriting with `mutated`. If no trace is active (SSE missed), fall back to `mutated` display.
- Use a ref or state flag in DisplayContext to coordinate between SSE events and the ChatPanel HTTP response

### Previous story intelligence (7.5)

- Story 7.5 implemented the manual-tab human-in-the-loop sampling flow with `sampling-pending` and `sampling-outcome` display states
- It added tab-aware gating: `sampling-request` events only activate UI in manual mode
- It added `submitSamplingResponse` and `cancelSamplingResponse` to DisplayContext
- It added `respondToSamplingRequest` helper to `client/src/mcp/client.ts`
- It established Vitest + React Testing Library test setup in `client/vitest.config.ts` and `client/src/test/setup.ts`
- It added tests in `DetailPanel.test.tsx` and `DisplayContext.test.tsx`
- Key lesson: tab-aware gating works via `activeTabRef.current` checks inside the SSE handler — follow the same pattern for trace events

### Git intelligence summary

- Recent commits follow Conventional Commits: `feat(7.5): ...`, `feat(7.4): ...`, etc.
- Most recent commit: `b0895e8 feat(7.5): complete manual sampling UX and tracking updates`
- Files modified across Epic 7:
  - `client/src/App.tsx`
  - `client/src/components/DetailPanel.tsx`
  - `client/src/components/ToolsPanel.tsx`
  - `client/src/context/DisplayContext.tsx`
  - `client/src/copy/mcpExplainer.ts`
  - `client/src/lib/parseSamplingEnrichment.ts`
  - `client/src/components/ChatPanel.tsx`
  - `client/src/index.css`

### Testing requirements

- Use existing Vitest + React Testing Library setup (from Story 7.5)
- Add unit tests for SSE `sampling-trace` event parsing/accumulation with tab-mode gating
- Add component tests for DetailPanel trace rendering (step order, annotations, collapsible JSON)
- Add component test for contextual preview on tool selection
- Validate no regressions in manual sampling flow and AI chat flow
- Run `cd client && npm run build` and `cd client && npm test` to verify

### References

- Epic/story requirements: `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Previous story: `_bmad-output/implementation-artifacts/7-5-client-human-in-the-loop-sampling-form-in-manual-tab.md`
- Proxy trace emission: `proxy/src/index.ts` lines 122-148 (AI mode trace) and lines 314-322 (enrichment-applied)
- Client display state: `client/src/context/DisplayContext.tsx`
- Client rendering: `client/src/components/DetailPanel.tsx`
- Client AI chat: `client/src/components/ChatPanel.tsx`
- Client tool selection: `client/src/components/ToolsPanel.tsx`
- Enrichment parser: `client/src/lib/parseSamplingEnrichment.ts`
- Educational copy: `client/src/copy/mcpExplainer.ts`

### Project context reference

- No `project-context.md` found in repository. Use story + epics + architecture artifacts as the authoritative implementation context.

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Added `SamplingTraceContent` and `SamplingPreviewContent` types to `DisplayContext.tsx` `DisplayContent` union; also exported `SamplingTraceStep` interface for use in `DetailPanel.tsx`.
- SSE `sampling-trace` handler in `DisplayContext.tsx` is AI-tab-gated using `activeTabRef.current === "ai"`, matching the `sampling-request` manual-tab pattern from Story 7.5. Steps are accumulated via `samplingTraceStepsRef` to avoid stale-closure issues with the functional `setDisplayContent` update.
- Coordination between SSE and ChatPanel: `samplingTraceActiveRef` is a ref (synchronous access) exposed via `isSamplingTraceActive()` on the context. ChatPanel calls `clearSamplingTrace()` at the start of each new message, then checks `isSamplingTraceActive()` in `displayMcpResult`. If trace is active, ChatPanel skips the `mutated` display; the `enrichment-applied` SSE event (emitted by proxy after the HTTP response) fills in the final steps.
- `DetailPanel.tsx` maps 4 SSE step types to 6 UI steps: `server-requested` → steps 1+2, `calling-ollama` → step 3, `ollama-responded` → step 4, `enrichment-applied` → steps 5+6. A vertical timeline connector (`sampling-trace__connector`) links all but the final step.
- `parseSamplingEnrichment` is reused in `DetailPanel` for `enrichment-applied` steps; must pass `{ title: "", description: "", priority: "", dueDate: "" }` as the `original` arg (not `{}`) so the field-in-map guard passes.
- `ToolsPanel.handleSelect()` sets `displayContent` to `"sampling-preview"` only when `create_task_using_sampling` is selected; all other tools proceed unchanged.
- Verified `SamplingPanel.tsx` does not exist and `App.tsx` contains no `SamplingPanel` references (removed in Story 7.5/earlier). All 8 original sampling copy keys confirmed present in `mcpExplainer.ts`.
- All 16 tests pass (4 new SSE tests in `DisplayContext.test.tsx`, 8 new rendering tests in `DetailPanel.test.tsx`). Build: zero TS errors.

### File List

- `client/src/context/DisplayContext.tsx` — added `SamplingTraceStep`, `SamplingTraceContent`, `SamplingPreviewContent` types; added `sampling-trace` SSE handler; added `samplingTraceActiveRef`, `samplingTraceStepsRef`, `isSamplingTraceActive()`, `clearSamplingTrace()` to provider; updated `DisplayState` interface and `useMemo` value.
- `client/src/components/DetailPanel.tsx` — added `SamplingTraceStep` import and `parseSamplingEnrichment` import; added `extractEnrichmentText()`, `renderTraceStep()`, `getStepOffset()` helpers; added `sampling-preview` and `sampling-trace` rendering branches.
- `client/src/components/ChatPanel.tsx` — destructures `isSamplingTraceActive` and `clearSamplingTrace` from `useDisplay()`; calls `clearSamplingTrace()` at the start of `handleSubmit`; skips `mutated` display for `create_task_using_sampling` when trace is active.
- `client/src/components/ToolsPanel.tsx` — `handleSelect()` calls `setDisplayContent({ type: "sampling-preview" })` when `create_task_using_sampling` is selected.
- `client/src/copy/mcpExplainer.ts` — added `samplingTraceTitle`, `samplingTraceStep1`–`samplingTraceStep6`, `samplingPreviewNote` constants.
- `client/src/index.css` — added sampling trace stepper/timeline CSS (connector line, numbered circles, field change styles, preview card styles).
- `client/src/context/DisplayContext.test.tsx` — added 4 tests: trace accumulation in AI mode, tab-gating in manual mode, `isSamplingTraceActive`, `clearSamplingTrace`.
- `client/src/components/DetailPanel.test.tsx` — refactored existing tests to use `makeDisplayState()` helper; added 5 trace rendering tests and 1 preview test.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated story 7.6 status: ready-for-dev → in-progress → review.

### Change Log

- 2026-04-02: Implemented Story 7.6 — Ollama sampling trace in AI tab, sampling-preview for tool selection, contextual education. All ACs satisfied. 16 tests pass, zero TS errors.
