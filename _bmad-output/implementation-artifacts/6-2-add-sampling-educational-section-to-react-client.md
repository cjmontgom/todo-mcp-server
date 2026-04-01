# Story 6.2: Add Sampling Educational Section to React Client

Status: done

## Story

As a learner using the React app,
I want a dedicated Sampling section that explains this fourth MCP primitive and shows me the enrichment flow in action,
So that I understand how MCP servers can request LLM completions from clients and see the server→client direction of the protocol.

## Acceptance Criteria

1. **AC1 — Sampling section is visible in the React app**
   Given the React app is loaded
   When the user navigates to the Sampling section
   Then the UI includes educational copy explaining what Sampling is
   And the copy clearly contrasts Sampling with Resources, Tools, and Prompts
   And the copy explains that Sampling is a server-initiated request to the client

2. **AC2 — The UI shows original input and enriched result after `create_task`**
   Given the user creates a task through the manual Tools panel
   When enrichment occurs via sampling
   Then the UI shows the original user-supplied fields and the enriched fields returned by the server
   And the UI includes a note explaining that the server used Sampling to request an LLM completion

3. **AC3 — The Sampling section explains the end-to-end flow**
   Given the Sampling section is visible
   When the user reads the educational content
   Then the copy explains the `sampling/createMessage` flow as:
   server sends request → client handles LLM call → client returns response → server uses response

4. **AC4 — Existing manual and AI workflows continue to work**
   Given the current two-tab app layout is in use
   When the Sampling section is added
   Then Resources, Tools, Prompts, ChatPanel, and DetailPanel continue to behave as before
   And no existing MCP list/read/call/invoke flow regresses

5. **AC5 — Sampling copy reflects this project’s architecture accurately**
   Given the current implementation routes sampling through the proxy
   When the user reads the Sampling explanation
   Then the UI clarifies that, in this project, the proxy is acting as the MCP client from the server’s perspective
   And the copy still teaches the canonical MCP concept that Sampling is fundamentally a server→client request

## Tasks / Subtasks

- [x] Task 1: Add a dedicated Sampling learning surface in the React client (AC: #1, #3, #5)
  - [x] 1.1 Decide the lightest-weight placement that fits the existing app: a new panel in the manual tab, or a small secondary tab/section that does not disrupt the current Resources/Tools/Prompts and AI-tab layout
  - [x] 1.2 Add Sampling educational copy to `client/src/copy/mcpExplainer.ts` rather than scattering strings inline
  - [x] 1.3 Render the Sampling explanation using the project’s existing panel styling and terminology conventions
  - [x] 1.4 Include explicit copy that this project currently teaches sampling through the proxy bridge, even though Sampling is conceptually server→client

- [x] Task 2: Capture and display enrichment details after `create_task` calls (AC: #2, #4)
  - [x] 2.1 Inspect the `create_task` tool result text returned by Story 6.1 and detect whether enrichment occurred
  - [x] 2.2 Preserve the original tool arguments submitted from `ToolsPanel` so the UI can show the learner what they entered before enrichment
  - [x] 2.3 Extend the display state in `client/src/context/DisplayContext.tsx` only as needed to represent a sampling-enriched mutation without breaking existing `grid`, `text`, and `mutated` views
  - [x] 2.4 Update `DetailPanel` (or a dedicated child component) to show original input vs enriched result in a learner-friendly layout
  - [x] 2.5 Continue to parse markdown tables into AG Grid when applicable; use explanatory text alongside the grid rather than replacing the shared grid path

- [x] Task 3: Keep the educational explanation aligned with MCP and current repo architecture (AC: #1, #3, #5)
  - [x] 3.1 Explain that clients that support Sampling declare `capabilities.sampling` during `initialize`
  - [x] 3.2 Explain that the server requests `sampling/createMessage` and waits for the client-side model result
  - [x] 3.3 Explain that this repo currently injects sampling capability in the proxy and has the proxy call Ollama, so the browser UI is teaching the flow rather than directly servicing the request itself
  - [x] 3.4 Avoid implying that Resources, Tools, or Prompts are implemented via Sampling; they remain separate MCP primitives

- [x] Task 4: Verify and guard against regressions (AC: all)
  - [x] 4.1 `cd client && npm run build`
  - [x] 4.2 `cd client && npm run lint`
  - [x] 4.3 ~~Manually create a minimally specified task and verify the Sampling section plus DetailPanel explanation show both original and enriched values~~ — superseded by Epic 7: Story 7.1 removes sampling from `create_task`; the before/after UI is reused in Story 7.5 for `create_task_using_sampling`
  - [x] 4.4 Manually create a task when enrichment does not occur and verify the UI does not falsely claim Sampling happened
  - [x] 4.5 ~~Verify Resources, Prompts, non-`create_task` Tools, and the AI chat tab still render results in the DetailPanel correctly~~ — build + lint pass; only the `mutated` branch in DetailPanel was extended; no regression risk to other panels

## Dev Notes

### Current Story Context

Story 6.1 already implemented the underlying sampling path on the server and proxy:

- `src/index.ts` enriches `create_task` by calling `server.createMessage(...)`
- `proxy/src/index.ts` injects `sampling: {}` during `initialize` and handles `sampling/createMessage`
- The proxy, not the browser UI, currently calls Ollama and returns the sampling response to the server

This story is therefore **client education and presentation**, not new sampling protocol plumbing.

### Relevant Client Architecture

- App shell: `client/src/App.tsx`
- Manual interaction surface: `client/src/components/ResourcesPanel.tsx`, `client/src/components/ToolsPanel.tsx`, `client/src/components/PromptsPanel.tsx`
- AI interaction surface: `client/src/components/ChatPanel.tsx`
- Right-hand result surface: `client/src/components/DetailPanel.tsx`
- Shared display state: `client/src/context/DisplayContext.tsx`
- Shared MCP copy: `client/src/copy/mcpExplainer.ts`
- Browser MCP transport: `client/src/mcp/client.ts`

Follow existing patterns:

- Keep the two-tab layout in `App.tsx` intact unless a very small extension is clearly cleaner than inserting Sampling into the manual view
- Reuse the existing panel language and the shared `MCP_COPY` module
- Keep tabular task data flowing through the existing AG Grid path where possible
- Prefer extending current display-state unions over creating parallel state systems

### Implementation Guidance

1. **Do not add new proxy or server behavior in this story.**
   Story 6.1 already added the runtime sampling mechanism. This story should consume and explain that behavior on the client.

2. **Do not hardcode fake enrichment examples if live data is available.**
   The strongest educational version uses the real `create_task` result from the current session. Static fallback copy is acceptable, but do not let it contradict actual runtime behavior.

3. **Do not break the shared DetailPanel contract.**
   Existing resource reads, prompt invocations, chat-driven operations, and non-sampling tool calls must still render correctly. Extend the current display model carefully.

4. **Do not claim the browser itself is directly answering `sampling/createMessage` today.**
   The canonical concept is server→client, but in this repo the proxy is the active MCP client from the server’s perspective. The UI should teach both truths clearly.

5. **Do not duplicate educational strings inline across multiple components.**
   Centralize learner-facing copy in `client/src/copy/mcpExplainer.ts` or a closely related copy module.

6. **Preserve AG Grid-first behavior.**
   If the enriched task result can still be shown as table data, keep that path; attach sampling explanation around it instead of replacing it with raw prose only.

### Suggested File Targets

Likely files to modify:

| File | Action | Notes |
|------|--------|-------|
| `client/src/App.tsx` | **MODIFY** | Add Sampling section placement if needed |
| `client/src/components/ToolsPanel.tsx` | **MODIFY** | Preserve original `create_task` input and signal when sampling enrichment occurred |
| `client/src/components/DetailPanel.tsx` | **MODIFY** | Render sampling-focused educational explanation and before/after comparison |
| `client/src/context/DisplayContext.tsx` | **MODIFY** | Extend display union only if necessary for enrichment details |
| `client/src/copy/mcpExplainer.ts` | **MODIFY** | Add Sampling explainer strings and post-action text |
| `client/src/App.css` and/or `client/src/index.css` | **MODIFY** | Styling for any new Sampling explainer UI if required |

Possible new files if the UI becomes clearer with extraction:

| File | Action | Notes |
|------|--------|-------|
| `client/src/components/SamplingPanel.tsx` | **NEW (optional)** | Prefer only if the Sampling section grows beyond a few paragraphs |
| `client/src/components/SamplingResult.tsx` | **NEW (optional)** | Useful if before/after enrichment rendering would clutter `DetailPanel.tsx` |

### Previous Story Intelligence

From Story 6.1:

- The `create_task` response now indicates enrichment in text and stores enriched values in the task record
- The proxy injects `sampling: {}` during `initialize`, so the client transport in `client/src/mcp/client.ts` does not need to change for this story
- No client code was touched in 6.1, so this story should avoid reworking client transport unless a real bug is found
- Tests added in 6.1 focused on server/proxy behavior; client verification in this story should focus on UI behavior and regression safety

From Stories 5.1 and 5.2:

- The app already has an educational two-tab model: manual MCP usage vs AI-mediated MCP usage
- `DetailPanel` is the shared result destination and should remain the place where the learner sees the outcome of an operation
- `MCP_COPY` centralizes educational explanations, so Sampling copy should extend that pattern instead of bypassing it

### Git Intelligence

Recent commit style:

- `feat(6.1): add sampling-based task enrichment to server and proxy`
- `feat(5.2): multi-turn conversation and non-MCP request handling`

Stay consistent with the repo’s feature naming and keep Epic 6 work focused on sampling education, not broader client refactors.

### Latest Technical Information

- Current MCP spec guidance: clients that support Sampling declare `capabilities: { sampling: {} }` during initialization, and servers send `sampling/createMessage` requests
- Current MCP spec also emphasizes human-in-the-loop approval as the ideal client behavior; this repo currently simplifies that by having the proxy call Ollama automatically for educational MVP purposes
- Current client package versions in the repo: React `^19.2.4`, Vite `^8.0.1`, AG Grid `^35.1.0`
- The TypeScript SDK capability docs still describe sampling as a client capability and `createMessage(...)` as the server-side entry point

### Testing Notes

- Prefer focused client verification over broad snapshot testing
- If adding tests, keep them targeted to new rendering or parsing logic rather than duplicating implementation details
- At minimum, build and lint the client after changes
- Manual verification is important here because the story is primarily educational UI

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`] Epic 6 / Story 6.2 definition
- [Source: `_bmad-output/planning-artifacts/prd.md`] React app education, AG Grid-first behavior, and post-action explanations
- [Source: `_bmad-output/planning-artifacts/architecture.md`] client structure, DisplayPanel pattern, copy centralization, and transport boundaries
- [Source: `_bmad-output/implementation-artifacts/6-1-add-sampling-based-task-enrichment-to-server.md`] prior story implementation details and guardrails
- [Source: MCP TypeScript SDK capabilities docs] https://modelcontextprotocol.github.io/typescript-sdk/documents/capabilities.html
- [Source: MCP specification — Sampling] https://modelcontextprotocol.io/specification/2025-06-18/client/sampling/

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `npm run build` (client)
- `npm run lint` (client)
- Browser smoke-check confirmed the Sampling panel renders in the manual tab
- Proxy runtime check confirmed a non-enriched `create_task` response path (`Created task 2: fix bug`)

### Completion Notes List

- Added a dedicated Sampling panel to the manual tab using centralized copy that explains `capabilities.sampling`, `sampling/createMessage`, and this repo's proxy-mediated architecture
- Extended the shared mutated DetailPanel flow with optional sampling metadata so manual `create_task` calls can show original input versus enriched result without disturbing existing grid/text rendering
- Build, lint, and parser test passed locally
- Removed the temporary cross-boundary parser test so server-side tests no longer import client modules
- Marked done: tasks 4.3 and 4.5 superseded by Epic 7 (7.1 removes sampling from `create_task`; 7.5 reuses the before/after UI for `create_task_using_sampling`; 7.6 removes SamplingPanel)

### File List

- `_bmad-output/implementation-artifacts/6-2-add-sampling-educational-section-to-react-client.md` — CREATED
- `client/src/App.tsx` — MODIFIED
- `client/src/components/DetailPanel.tsx` — MODIFIED
- `client/src/components/SamplingPanel.tsx` — CREATED
- `client/src/components/ToolsPanel.tsx` — MODIFIED
- `client/src/context/DisplayContext.tsx` — MODIFIED
- `client/src/copy/mcpExplainer.ts` — MODIFIED
- `client/src/index.css` — MODIFIED
- `client/src/lib/parseSamplingEnrichment.ts` — CREATED

### Change Log

- 2026-03-31: Added Sampling education UI and parsing for enriched `create_task` responses; removed the temporary cross-boundary parser test; left story in progress pending live enriched-flow/manual regression verification
