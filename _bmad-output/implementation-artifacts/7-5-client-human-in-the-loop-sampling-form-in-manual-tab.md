# Story 7.5: Client — Human-in-the-Loop Sampling Form in the "You are the MCP Client" Tab

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner in the manual tab,
I want to see the server's `sampling/createMessage` request and answer it myself,
So that I literally act as the MCP client and understand that sampling puts the LLM decision in my hands.

## Acceptance Criteria

1. **AC1 — Manual tab shows actionable Sampling Request block after `create_task_using_sampling`**
   Given I have called `create_task_using_sampling` from the Tools panel  
   When the server sends a `sampling/createMessage` request (proxied as SSE `sampling-request`)  
   Then the right-hand DetailPanel shows a **Sampling Request** block containing:
   - the full prompt text sent by the server
   - the educational note: "The server sent this sampling/createMessage request and is waiting for your LLM response. You are the MCP client."
   - a text area pre-populated with a JSON template for expected enrichment
   - **Submit** and **Cancel** actions

2. **AC2 — Valid submit resolves pending request and shows comparison**
   Given I submit a valid enrichment JSON response  
   When the browser POSTs it to `POST /mcp/sampling/respond`  
   Then the pending sampling request resolves successfully  
   And DetailPanel replaces the form with original-vs-enriched comparison  
   And shows: "You answered the server's sampling/createMessage — you acted as the MCP client."

3. **AC3 — Cancel path returns server error and clear UI state**
   Given I click Cancel on an active sampling request  
   When the browser sends a cancel signal to the proxy response endpoint  
   Then DetailPanel shows: "Sampling cancelled — no task was created. The server received an error response."  
   And the related `tools/call` resolves with `isError: true`.

4. **AC4 — Timeout path is clearly surfaced**
   Given no response is submitted within the proxy timeout window  
   When the proxy expires the pending request and returns an error  
   Then DetailPanel shows: "The sampling request expired. Try calling the tool again."

5. **AC5 — Manual-only activation**
   Given an SSE `sampling-request` event arrives while the AI tab is active  
   When the event is received by the browser  
   Then it is ignored for rendering/interaction (no human form appears in AI tab).

6. **AC6 — Right panel includes sampling explainer + app-specific context**
   Given I am in the manual tab and viewing the DetailPanel for sampling-related states  
   When the panel renders the sampling UI (preview, pending request, success, cancel, or timeout)  
   Then it includes a concise "What is Sampling?" explanation of MCP sampling in general  
   And includes a separate "Sampling in this app" explanation that clarifies:
   - server emits `sampling/createMessage`
   - in manual mode, I provide the response (I am the MCP client)
   - my response is sent to `POST /mcp/sampling/respond` and used to finish task enrichment.

7. **AC7 — Build and tests remain green**
   Given the story is implemented  
   When `npm run build` runs in `client/`  
   Then TypeScript reports zero errors  
   And relevant tests (new and existing) pass.

## Tasks / Subtasks

- [x] Task 1: Add client-side sampling request state and event plumbing (AC: #1, #5)
  - [x] 1.1 Define a UI state shape for pending sampling requests (id, prompt text, raw messages, maxTokens, startedAt, source mode).
  - [x] 1.2 Create a single SSE subscription point (likely in `client/src/context/DisplayContext.tsx` or dedicated context) that listens on proxy `/sse`.
  - [x] 1.3 Parse `event: message` JSON payloads and branch by `type`.
  - [x] 1.4 For `type: "sampling-request"`, update pending sampling state **only when manual tab is active**.
  - [x] 1.5 Ignore `sampling-request` UI activation in AI mode; do not disturb existing AI sampling trace behavior.

- [x] Task 2: Wire active tab awareness into display flow (AC: #5)
  - [x] 2.1 Lift or expose current tab mode to whichever layer handles sampling events.
  - [x] 2.2 Ensure tab switches cleanly hide/disable manual sampling input UI when in AI mode.
  - [x] 2.3 Guard against race conditions where a stale event arrives after switching tabs.

- [x] Task 3: Implement DetailPanel Sampling Request form UI (AC: #1, #6)
  - [x] 3.1 Add a new display variant for "pending sampling request" (rather than overloading existing `mutated`/`text` types).
  - [x] 3.2 Render the full prompt text extracted from sampling messages (preserve line breaks and readability).
  - [x] 3.3 Pre-fill text area with a JSON template matching server enrichment expectations:
        `{ "title": "...", "description": "...", "priority": "low|medium|high", "dueDate": "YYYY-MM-DD" }`.
  - [x] 3.4 Add educational copy exactly aligned with AC wording.
  - [x] 3.5 Add Submit and Cancel controls with loading/disabled states to prevent duplicate sends.
  - [x] 3.6 In the same right-panel block, add two explicit educational sections:
        - "What is Sampling?" (general MCP explanation)
        - "Sampling in this app" (server -> manual client -> response endpoint -> enrichment completion).

- [x] Task 4: Implement submit/cancel transport to proxy endpoint (AC: #2, #3)
  - [x] 4.1 Add helper in `client/src/mcp/client.ts` for `POST /mcp/sampling/respond`.
  - [x] 4.2 For Submit, send `{ id, response: { role: "assistant", content: { type: "text", text: "<textarea value>" } } }`.
  - [x] 4.3 For Cancel, send an MCP-shaped error response payload that causes server-side `isError: true` path (coordinate shape with proxy implementation from Story 7.3).
  - [x] 4.4 Handle 400/404 responses with clear user-facing error messages.

- [x] Task 5: Connect post-submit outcome to existing comparison UI (AC: #2, #4, #6)
  - [x] 5.1 Keep existing mutation result rendering in `DetailPanel` for success paths.
  - [x] 5.2 Reuse existing sampling comparison presentation (`displayContent.type === "mutated"` with `sampling`) where possible.
  - [x] 5.3 Add explicit timeout/cancel messaging variants that do not look like generic network failures.
  - [x] 5.4 Keep the two educational sections visible across sampling states (pending/success/cancel/timeout) so context is always present in the right panel.

- [x] Task 6: Regression-safe integration with tools workflow (AC: #1-#4)
  - [x] 6.1 Ensure `create_task_using_sampling` (not `create_task`) triggers human-in-the-loop flow in manual mode.
  - [x] 6.2 Do not break parsing behavior for existing "enriched by AI" text path (`parseSamplingEnrichment`) used by current UI.
  - [x] 6.3 Preserve current behavior for non-sampling tools/resources/prompts.

- [x] Task 7: Tests and verification (AC: #7)
  - [x] 7.1 Add unit tests around SSE event parsing/dispatch and tab-mode gating.
  - [x] 7.2 Add component tests for DetailPanel sampling request form interactions (submit/cancel/timeout states).
  - [x] 7.2b Add assertions that both educational sections render in sampling states with expected wording.
  - [x] 7.3 Validate manual path end-to-end with proxy + server running:
        - call `create_task_using_sampling` in manual tab
        - submit valid enrichment JSON
        - verify original/enriched comparison appears
  - [x] 7.4 Validate AI tab ignores human sampling request form activation.
  - [x] 7.5 Run `cd client && npm run build` and `cd client && npm test`.

## Dev Notes

### Technical requirements (must follow)

- Proxy contract from Story 7.3 is authoritative:
  - SSE human event: `{ type: "sampling-request", id, messages, maxTokens }`
  - Response endpoint: `POST /mcp/sampling/respond`
- Keep endpoint-based routing assumptions intact:
  - manual `/mcp` calls are human-mode
  - AI `/llm/interpret` calls are AI-mode
- Do not alter proxy/server contracts in this story; this is client-only behavior.

### Architecture compliance

- Keep code in `client/` package; no server/proxy changes unless a strict bug fix is required.
- Follow existing React + context + panel structure:
  - tab selection in `client/src/App.tsx`
  - shared display state in `client/src/context/DisplayContext.tsx`
  - rendering in `client/src/components/DetailPanel.tsx`
- Preserve MCP terminology and educational tone from `client/src/copy/mcpExplainer.ts`.
- Prefer centralizing new explanatory copy in `client/src/copy/mcpExplainer.ts` (not hard-coded in JSX) so Story 7.6 can reuse it.

### Library/framework requirements

- React + TypeScript patterns already in use in `client/` are sufficient; no new UI framework.
- Continue using fetch/EventSource-compatible browser APIs for proxy communication.
- Keep strict TypeScript typing for payloads and display state unions.

### File structure requirements

| File | Action |
|------|--------|
| `client/src/App.tsx` | Update tab-awareness plumbing as needed for sampling UI gating |
| `client/src/context/DisplayContext.tsx` | Extend display state/types for pending sampling request and resolved status |
| `client/src/components/DetailPanel.tsx` | Render Sampling Request block + submit/cancel/timeout states |
| `client/src/mcp/client.ts` | Add typed helper for `POST /mcp/sampling/respond` |
| `client/src/components/ToolsPanel.tsx` | Integrate with pending request initiation/cleanup only if needed |
| `client/src/copy/mcpExplainer.ts` | Add/adjust targeted educational copy strings for new sampling UI |

| File | Do NOT modify (unless critical bug fix) |
|------|-----------------------------|
| `proxy/src/index.ts` | Story 7.3 already defines routing and endpoint behavior |
| `proxy/src/sampling.ts` | Sampling fulfillment logic for AI mode remains unchanged |
| `src/index.ts` | Server tools logic is out of scope |

### Testing requirements

- Prefer fast unit/component tests for parsing and rendering state transitions.
- Add at least one integration-style test (or scripted manual verification notes) covering:
  - pending request appears
  - submit resolves
  - cancel error path
  - timeout messaging path
- Validate no regressions in existing manual Tools flow and AI chat flow.

### Previous story intelligence (7.4 and 7.3)

- 7.4 introduced stronger tool-selection guidance so underspecified AI requests choose `create_task_using_sampling`; 7.5 must not regress that by showing human-only UI in AI contexts.
- 7.3 established the event and endpoint contract this story must consume:
  - `sampling-request` events are emitted for human mode
  - `sampling-trace` events are for AI observability
  - timeout and unknown-id handling already implemented server-side/proxy-side
- Existing DetailPanel already supports enriched comparison rendering for mutation results; reuse this path where practical instead of creating duplicate layouts.

### Git intelligence summary

- Recent commit pattern uses Conventional Commits with story-scoped tags:
  - `feat(7.2)`, `feat(7.3)`, `feat(7.4)`
- Relevant files changed in recent epic work:
  - `client/src/App.tsx`
  - `client/src/components/DetailPanel.tsx`
  - `client/src/components/ToolsPanel.tsx`
  - `client/src/context/DisplayContext.tsx`
  - `client/src/copy/mcpExplainer.ts`
  - `client/src/lib/parseSamplingEnrichment.ts`
- Keep implementation aligned with these established file ownership boundaries.

### Latest technical information

- MCP 2024-11-05 sampling spec confirms:
  - server sends `sampling/createMessage`
  - client returns a message result object (`role`, `content`, optional model metadata)
  - human-in-the-loop review is recommended
- SSE browser handling remains stable and broadly supported:
  - `EventSource` `message` events provide payload via `MessageEvent.data`
  - use robust JSON parsing and graceful fallback for malformed events

### References

- Epic/story requirements: `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.5)
- Architecture constraints: `_bmad-output/planning-artifacts/architecture.md`
- Prior implementation context:
  - `_bmad-output/implementation-artifacts/7-3-proxy-endpoint-based-sampling-routing-sse-events-and-human-response-endpoint.md`
  - `_bmad-output/implementation-artifacts/7-4-proxy-update-system-prompt-for-smart-ollama-tool-selection.md`
- Current client implementation:
  - `client/src/App.tsx`
  - `client/src/components/DetailPanel.tsx`
  - `client/src/components/ToolsPanel.tsx`
  - `client/src/context/DisplayContext.tsx`
  - `client/src/mcp/client.ts`
  - `client/src/copy/mcpExplainer.ts`

### Project context reference

- No `project-context.md` found in repository. Use story + epics + architecture artifacts as the authoritative implementation context.

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- Added `DisplayProvider` SSE subscription and manual-only sampling gating; parsed `sampling-request` and `sampling-request-error` events.
- Added `DetailPanel` sampling request state rendering with JSON validation plus submit/cancel flows.
- Added transport helper `respondToSamplingRequest` in `client/src/mcp/client.ts` with explicit 400/404 handling.
- Added Vitest + Testing Library setup and new tests for context gating and DetailPanel sampling states.

### Completion Notes List

- Implemented manual-tab human-in-the-loop sampling flow using SSE `sampling-request` events and a dedicated `sampling-pending` display state.
- Added tab-aware gating so sampling request UI does not activate in AI mode and manual-only sampling UI is hidden while AI tab is active.
- Implemented submit and cancel handlers to `POST /mcp/sampling/respond`, with explicit timeout/cancel outcome messaging in the right panel.
- Reused existing mutated comparison rendering for successful enrichment and added explicit educational copy for pending/success/cancel/timeout states.
- Added unit/component tests for SSE parsing and tab gating, pending form interactions, cancel/timeout outcome states, and educational sections.
- Validation run completed in `client/`: `npm test`, `npm run build`, and `npm run lint` all pass.

### File List

- `client/package.json` (modified)
- `client/package-lock.json` (modified)
- `client/src/App.tsx` (modified)
- `client/src/components/DetailPanel.tsx` (modified)
- `client/src/components/DetailPanel.test.tsx` (added)
- `client/src/components/ToolsPanel.tsx` (modified)
- `client/src/context/DisplayContext.tsx` (modified)
- `client/src/context/DisplayContext.test.tsx` (added)
- `client/src/copy/mcpExplainer.ts` (modified)
- `client/src/index.css` (modified)
- `client/src/mcp/client.ts` (modified)
- `client/src/test/setup.ts` (added)
- `client/vitest.config.ts` (added)

## Change Log

- 2026-04-02: Implemented Story 7.5 client-side human-in-the-loop sampling flow, added sampling response transport, and introduced Vitest-based UI/context test coverage.

## Story completion status

- **Status:** done
- **Note:** Story implemented and validated; ready for code review.
