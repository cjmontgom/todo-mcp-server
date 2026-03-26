# Story 5.1: Add LLM Interpretation Endpoint and Chat UI

Status: review

## Story

As a learner using the React app,
I want to type a plain-language request like "show me all high priority tasks" into a chat input,
So that an AI interprets my request, executes the right MCP operation, and shows me the result — teaching me how AI agents use MCP.

## Acceptance Criteria

1. **AC1 — Proxy LLM endpoint accepts natural language and returns structured MCP intent + result**
   Given the proxy is running and Ollama is available at `LLM_BASE_URL` (default `http://localhost:11434`) with `LLM_MODEL` pulled (default `llama3.1`)
   When the React app sends `POST /llm/interpret` with `{ message: "show me tasks sorted by deadline", history: [] }`
   Then the proxy calls the LLM, determines the MCP operation, executes it via the bridge, and returns `{ explanation: string, operation: { type, params }, mcpResult: object }`

2. **AC2 — ChatPanel replaces manual panels under "Ollama is the MCP Client" tab**
   Given the React app is loaded
   When the user clicks the "Ollama is the MCP Client" tab in the left column
   Then the manual panels (Resources, Tools, Prompts) are replaced by a ChatPanel with a text input and scrollable conversation area; the right-column DetailPanel remains visible and shared (UX-DR14)

3. **AC3 — LLM selects MCP operation and results appear in shared DetailPanel**
   Given the user types "show me overdue tasks sorted by priority" and submits
   When the proxy processes the request
   Then the LLM selects the appropriate MCP operation, the proxy executes it, and: (1) the chat panel displays the AI's explanation with an educational note like "The AI read the resource task://table/by-priority — this is exactly how an MCP client uses Resources."; (2) tabular MCP results render in the shared right-column DetailPanel via `setDisplayContent` (FR31, UX-DR11, UX-DR14)

4. **AC4 — Loading state visible during LLM processing**
   Given the LLM request is in-flight
   When the user waits
   Then a loading indicator is visible in the chat area and the input is disabled (UX-DR12)

5. **AC5 — LLM errors shown inline in chat**
   Given the LLM API returns an error (provider unreachable, malformed response)
   When the error is received
   Then an error message is shown inline in the chat conversation (UX-DR13)

6. **AC6 — Ollama-not-running fallback**
   Given Ollama is not running or the configured LLM provider is unreachable
   When the proxy receives a `/llm/interpret` request
   Then the proxy returns a clear error; the React app shows an inline chat error with setup instructions

7. **AC7 — Tab switching preserves DetailPanel and both tabs work**
   Given the two-tab left column is rendered ("You are the MCP Client" / "Ollama is the MCP Client")
   When the user switches between tabs
   Then the left column swaps content; the right-column DetailPanel retains content from the most recent MCP operation from either tab; both modes share the same `setDisplayContent` mechanism (UX-DR14)

8. **AC8 — App subtitle adapts per tab**
   Given the user switches tabs
   When the subtitle renders
   Then it reflects the current mode — manual ("You are the MCP client…") or AI-mediated ("Ollama is the MCP client…")

## Tasks / Subtasks

- [x] Task 1: Add LLM module to proxy (`proxy/src/llm.ts`) (AC: #1, #6)
  - [x] 1.1 Create `proxy/src/llm.ts` exporting `interpretWithLlm(message, history, capabilities)` function
  - [x] 1.2 Read `LLM_BASE_URL` (default `http://localhost:11434`), `LLM_MODEL` (default `llama3.1`), optional `LLM_API_KEY` from env
  - [x] 1.3 Build system prompt listing available MCP capabilities (resources, tools, prompts) and instructing the LLM to return a JSON object `{ explanation, operation: { type, params } }`
  - [x] 1.4 Call Ollama's OpenAI-compatible `POST ${LLM_BASE_URL}/v1/chat/completions` with `{ model, messages: [system, ...history, user] }` using `fetch` (no SDK)
  - [x] 1.5 Parse LLM response, extract JSON from content, validate the operation structure
  - [x] 1.6 Handle LLM errors (network failure, non-JSON response, missing fields) with descriptive error messages

- [x] Task 2: Add `/llm/interpret` endpoint to proxy (`proxy/src/index.ts`) (AC: #1, #6)
  - [x] 2.1 Import `interpretWithLlm` from `./llm.js`
  - [x] 2.2 On proxy startup, gather MCP capabilities by sending `resources/list`, `tools/list`, `prompts/list` through the bridge after `initialize` completes
  - [x] 2.3 Add `POST /llm/interpret` route that accepts `{ message: string, history: Array<{ role: string, content: string }> }`
  - [x] 2.4 Call `interpretWithLlm` with message, history, and cached capabilities
  - [x] 2.5 Execute the LLM-selected MCP operation through the bridge (resource read, tool call, or prompt get)
  - [x] 2.6 Return `{ explanation: string, operation: { type, params }, mcpResult: object }` on success
  - [x] 2.7 Return descriptive error JSON on failure (LLM unreachable, MCP operation failed, invalid intent)
  - [x] 2.8 Log `POST /llm/interpret` in startup console alongside existing route listing

- [x] Task 3: Add chat client function (`client/src/mcp/client.ts`) (AC: #1)
  - [x] 3.1 Export `ChatMessage` type: `{ role: "user" | "assistant"; content: string }`
  - [x] 3.2 Export `LlmInterpretResult` type: `{ explanation: string; operation: { type: string; params: Record<string, unknown> }; mcpResult: unknown }`
  - [x] 3.3 Export `interpretMessage(message: string, history: ChatMessage[]): Promise<LlmInterpretResult>` — `POST ${BASE_URL}/llm/interpret`, no JSON-RPC wrapping (plain REST), no `ensureInitialized` needed

- [x] Task 4: Update `mcpExplainer.ts` with chat-related copy (AC: #3, #8)
  - [x] 4.1 Add `chatBlurb: "Type a plain-language request and watch the AI select and execute the right MCP operation. This demonstrates how AI agents like Claude use MCP under the hood."`
  - [x] 4.2 Add `appSubtitleManual` — the current `appSubtitle` text (for the "You are the MCP Client" tab)
  - [x] 4.3 Add `appSubtitleAi: "Watch Ollama (the MCP client) interpret your plain-language requests, select the right MCP operation, and execute it — just like Claude Desktop or Cursor does under the hood."`
  - [x] 4.4 Add `postActionAiRead: (uri: string) => \`The AI read the resource ${uri} — this is exactly how an MCP client uses Resources.\``
  - [x] 4.5 Add `postActionAiCall: (toolName: string) => \`The AI called the ${toolName} Tool — Tools change server state, unlike Resources which are read-only.\``
  - [x] 4.6 Add `postActionAiInvoke: (promptName: string) => \`The AI invoked the ${promptName} Prompt — Prompts return structured, LLM-oriented content.\``
  - [x] 4.7 Add `ollamaSetupHint: "LLM features require Ollama running locally. Install: brew install ollama && ollama pull llama3.1"`

- [x] Task 5: Create `ChatPanel.tsx` component (AC: #2, #3, #4, #5, #6)
  - [x] 5.1 Create `client/src/components/ChatPanel.tsx`
  - [x] 5.2 Local state: `messages: Array<{ role: "user" | "assistant"; content: string; error?: boolean }>`, `inputValue: string`, `isLoading: boolean`
  - [x] 5.3 Render blurb from `MCP_COPY.chatBlurb` at top
  - [x] 5.4 Scrollable conversation area: user messages right-aligned, AI responses left-aligned (UX-DR10)
  - [x] 5.5 Text input + submit button at bottom; submit on Enter or button click; disable during loading
  - [x] 5.6 On submit: add user message to local state, set `isLoading: true`, call `interpretMessage`, add assistant message with explanation, call `setDisplayContent` with parsed MCP result (grid/text/mutated depending on operation type), set `isLoading: false`
  - [x] 5.7 Parse MCP result for DetailPanel: use `parseMarkdownTable`/`parseJsonTaskArray` from existing `lib/` to convert to `GridRow[]`; set display as `grid` for tabular results, `text` for non-tabular, with AI post-action copy
  - [x] 5.8 Show typing indicator during loading (UX-DR12)
  - [x] 5.9 On error: add an error-styled message to conversation (UX-DR13)
  - [x] 5.10 On Ollama-not-running error: show `MCP_COPY.ollamaSetupHint` in the error message

- [x] Task 6: Add tab navigation to `App.tsx` (AC: #2, #7, #8)
  - [x] 6.1 Add local state: `activeTab: "manual" | "ai"` (default `"manual"`)
  - [x] 6.2 Render two tab buttons above the panels column: "You are the MCP Client" / "Ollama is the MCP Client"
  - [x] 6.3 Conditionally render `panels-column` children: if `"manual"` → ResourcesPanel + ToolsPanel + PromptsPanel; if `"ai"` → ChatPanel
  - [x] 6.4 Update subtitle: `activeTab === "manual" ? MCP_COPY.appSubtitleManual : MCP_COPY.appSubtitleAi`
  - [x] 6.5 DetailPanel stays outside the conditional — always rendered in the right column

- [x] Task 7: Add CSS for chat panel and tabs (`client/src/App.css` + `client/src/index.css`) (AC: #2, #4)
  - [x] 7.1 Tab bar styling: `.tab-bar` flex row; `.tab-button` with active/inactive states
  - [x] 7.2 Chat conversation area: `.chat-panel`, `.chat-messages` (scrollable), `.chat-message`, `.chat-message--user` (right-aligned), `.chat-message--assistant` (left-aligned), `.chat-message--error` (error styling)
  - [x] 7.3 Chat input area: `.chat-input-area` flex row; input fills remaining width; submit button
  - [x] 7.4 Typing indicator: `.chat-typing` with animation

- [x] Task 8: Build and verify (AC: all)
  - [x] 8.1 `cd client && npm run build` — zero TypeScript errors
  - [x] 8.2 `cd client && npm run lint` — zero ESLint errors
  - [x] 8.3 Proxy starts with LLM endpoint logged: `POST /llm/interpret`
  - [x] 8.4 Manual tab works identically to pre-story behavior (no regression)
  - [x] 8.5 Switch to AI tab → ChatPanel visible with blurb and input
  - [x] 8.6 Type "show me all tasks" → loading indicator → AI response with explanation → DetailPanel shows grid
  - [x] 8.7 Switch back to manual tab → DetailPanel retains content from AI operation
  - [x] 8.8 Stop Ollama → type message → inline error with setup instructions
  - [x] 8.9 Subtitle changes when switching tabs

## Dev Notes

### Proxy — LLM Module (`proxy/src/llm.ts`)

**Architecture:** The proxy does three things in `/llm/interpret`: (1) send user message + capabilities to LLM, (2) parse LLM's structured response to determine which MCP operation to run, (3) execute that MCP operation through the existing bridge and return both the explanation and the MCP result. This keeps the React client simple — it makes one HTTP call and gets everything back.

**Ollama OpenAI-compatible API (confirmed current as of March 2026):**
- Endpoint: `POST ${LLM_BASE_URL}/v1/chat/completions`
- Body: `{ model: string, messages: Array<{ role: "system"|"user"|"assistant", content: string }>, temperature?: number }`
- Response: `{ choices: [{ message: { content: string } }] }`
- No API key needed for Ollama (it ignores the Authorization header)
- For cloud providers (OpenAI, Anthropic-compatible): set `LLM_API_KEY` env var, send as `Authorization: Bearer ${key}`

**Env vars (read in `proxy/src/llm.ts`, NOT in `proxy/src/index.ts`):**
```
LLM_BASE_URL  — default "http://localhost:11434"
LLM_MODEL     — default "llama3.1"
LLM_API_KEY   — optional, empty for Ollama
```

**System prompt strategy:** Build a system prompt that includes the full list of available MCP capabilities (resource URIs, tool names + schemas, prompt names + args). Instruct the LLM to respond with a JSON block containing `explanation` (human-readable) and `operation` (`{ type: "resource_read" | "tool_call" | "prompt_get", params: { ... } }`). Use low `temperature` (e.g. 0.1) for structured output reliability.

**Capability gathering:** On proxy startup, after the bridge is alive, send `initialize`, then `resources/list`, `tools/list`, `prompts/list` through the bridge. Cache the results. This is a one-time operation at startup — capabilities don't change at runtime for this MVP.

**MCP operation execution:** After parsing the LLM's intent:
- `resource_read` → bridge.send `resources/read` with `{ uri }`
- `tool_call` → bridge.send `tools/call` with `{ name, arguments }`
- `prompt_get` → bridge.send `prompts/get` with `{ name, arguments }`

**Error handling chain:**
1. LLM network error (Ollama not running) → return `{ error: "LLM provider unreachable at ${LLM_BASE_URL}. Ensure Ollama is running." }`
2. LLM returns non-parseable response → return `{ error: "LLM returned an unstructured response. Try rephrasing." }`
3. MCP operation fails → return `{ error: "MCP operation failed: ${mcpError.message}", explanation: llmExplanation }`

### Proxy — Endpoint Integration (`proxy/src/index.ts`)

**Import pattern:** Follow existing ESM convention — `import { interpretWithLlm, gatherCapabilities } from "./llm.js";` (note `.js` extension for Node ESM).

**Startup flow update:** After `bridge.start(SERVER_PATH)`, the bridge is alive but MCP isn't initialized. The `/llm/interpret` handler must ensure capabilities are gathered before first use. Use a lazy init pattern: `let capabilitiesPromise: Promise<Capabilities> | null = null;` — on first `/llm/interpret` request, call `gatherCapabilities(bridge)` which does the `initialize` + three `list` calls. Cache the promise so subsequent requests reuse it.

**IMPORTANT — The `/llm/interpret` endpoint is plain REST, NOT JSON-RPC.** It does not use `jsonrpc: "2.0"` envelope. This is intentional: the LLM endpoint is a proxy-specific feature, not an MCP protocol operation. Request body: `{ message: string, history: Array<{ role: string, content: string }> }`. Response body: `{ explanation: string, operation: { type: string, params: object }, mcpResult: object }` or `{ error: string }`.

**IMPORTANT — JSON-RPC ID management for bridge calls:** The bridge's `send()` expects a `jsonrpc: "2.0"` message with an `id`. The proxy must generate unique IDs for the MCP calls it makes on behalf of the LLM endpoint. Use a module-level counter (e.g. `let internalRequestId = 100000;`) to avoid collisions with browser client IDs (which start at 1). Increment for each bridge call in the LLM flow.

**No new dependencies for the proxy.** `fetch` is available globally in Node 18+. No vendor SDK.

### Client — `interpretMessage` in `client/src/mcp/client.ts`

**This is a plain REST call, not JSON-RPC.** Unlike the existing `sendJsonRpc` helper, this is a simple `fetch POST` to `${BASE_URL}/llm/interpret`. It does NOT go through `sendJsonRpc` or `ensureInitialized`.

```typescript
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmInterpretResult {
  explanation: string;
  operation: { type: string; params: Record<string, unknown> };
  mcpResult: unknown;
  error?: string;
}

export async function interpretMessage(
  message: string,
  history: ChatMessage[],
): Promise<LlmInterpretResult> {
  // POST to /llm/interpret — NOT JSON-RPC
}
```

### Client — ChatPanel.tsx

**Component location:** `client/src/components/ChatPanel.tsx`

**State management:** Local `useState` only (not in McpContext or DisplayContext). Conversation history is local to the ChatPanel component and persists across tab switches because the ChatPanel is conditionally rendered but not unmounted-and-destroyed when switching — OR use a ref/state lift if needed to preserve across unmount.

**CRITICAL: Preserving chat history across tab switches.** The simplest approach: lift `messages` state to `App.tsx` and pass down to `ChatPanel` as props. This avoids losing conversation when the user switches between manual and AI tabs. The `ChatPanel` component itself manages `inputValue` and `isLoading` locally.

**DetailPanel integration:** After receiving the LLM response, `ChatPanel` calls `setDisplayContent` from `useDisplay()` with the parsed MCP result. Use the same parsing pipeline as existing panels:
- For `resource_read` results: extract `contents[0]` → if JSON task array, `parseJsonTaskArray`; if markdown table, `parseMarkdownTable` → set `{ type: "grid", rows, postAction: MCP_COPY.postActionAiRead(uri) }`
- For `tool_call` results: check if mutating tool → `{ type: "mutated", ... }` or `{ type: "grid", ... }`
- For `prompt_get` results: extract message text → `parseMarkdownTable` → `{ type: "grid", rows, postAction: MCP_COPY.postActionAiInvoke(name) }` or `{ type: "text", ... }`

**Reuse existing parsing utilities:** Import `parseMarkdownTable`, `parseJsonTaskArray` from `../lib/parseMarkdownTable`; import `GridRow` type. Do NOT create new parsers.

### Client — App.tsx Tab Navigation

**Tab state:** `const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");`

**Layout change:** The `<div className="panels-column">` now contains a tab bar at the top, then conditionally renders either the three manual panels or the ChatPanel.

```tsx
<div className="panels-column">
  <div className="tab-bar">
    <button className={`tab-button ${activeTab === "manual" ? "tab-button--active" : ""}`} onClick={() => setActiveTab("manual")}>
      You are the MCP Client
    </button>
    <button className={`tab-button ${activeTab === "ai" ? "tab-button--active" : ""}`} onClick={() => setActiveTab("ai")}>
      Ollama is the MCP Client
    </button>
  </div>
  {activeTab === "manual" ? (
    <>
      <ResourcesPanel />
      <ToolsPanel />
      <PromptsPanel />
    </>
  ) : (
    <ChatPanel messages={chatMessages} onMessagesChange={setChatMessages} />
  )}
</div>
```

**Subtitle update:** In the header, use `activeTab` to select between `MCP_COPY.appSubtitleManual` and `MCP_COPY.appSubtitleAi`. The existing `appSubtitle` key should be renamed to `appSubtitleManual` (keep the old key as an alias if needed for backward compatibility, or just rename — it's only used in `App.tsx`).

### Client — CSS Additions

**Tab bar (`App.css` or `index.css`):**
- `.tab-bar`: `display: flex; border-bottom: 1px solid var(--border);`
- `.tab-button`: `flex: 1; padding: 12px 16px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-secondary);`
- `.tab-button--active`: `color: var(--text-primary); border-bottom: 2px solid var(--accent, #4f46e5);`

**Chat panel (`index.css`):**
- `.chat-panel`: `display: flex; flex-direction: column; height: 100%; padding: 16px 24px;`
- `.chat-messages`: `flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px;`
- `.chat-message`: `max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5;`
- `.chat-message--user`: `align-self: flex-end; background: var(--accent, #4f46e5); color: white;`
- `.chat-message--assistant`: `align-self: flex-start; background: var(--surface, #1e1e2e); border: 1px solid var(--border);`
- `.chat-message--error`: `align-self: flex-start; background: var(--error-bg, #2d1b1b); border: 1px solid var(--error, #ef4444); color: var(--error, #ef4444);`
- `.chat-input-area`: `display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border);`
- `.chat-input-area input`: `flex: 1; padding: 10px 14px; border-radius: 8px;`
- `.chat-typing`: animated dots or spinner indicating AI is thinking

**Use existing CSS variables** from `index.css`: `--bg`, `--surface`, `--text`, `--text-secondary`, `--border`, `--accent`, `--error`. Do NOT introduce new color values as raw hex outside CSS vars.

### Project Structure Notes

Files created/modified by this story:

| File | Action | Notes |
|------|--------|-------|
| `proxy/src/llm.ts` | **CREATE** | LLM interpretation module |
| `proxy/src/index.ts` | **MODIFY** | Add `/llm/interpret` route, import llm module, capability gathering |
| `client/src/mcp/client.ts` | **MODIFY** | Add `interpretMessage`, `ChatMessage`, `LlmInterpretResult` exports |
| `client/src/copy/mcpExplainer.ts` | **MODIFY** | Add chat-related copy keys |
| `client/src/components/ChatPanel.tsx` | **CREATE** | Chat UI component |
| `client/src/App.tsx` | **MODIFY** | Tab navigation, conditional rendering, subtitle switching |
| `client/src/App.css` | **MODIFY** | Tab bar styles |
| `client/src/index.css` | **MODIFY** | Chat panel styles |

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server) — zero changes
- `proxy/src/spawnMcpServer.ts` — bridge code unchanged
- `proxy/package.json` — no new dependencies (uses native `fetch`)
- `client/package.json` — no new dependencies
- `client/src/context/McpContext.tsx` — catalog state unchanged
- `client/src/context/DisplayContext.tsx` — `DisplayContent` type unchanged; no new variants needed
- `client/src/components/DetailPanel.tsx` — renders existing types; no modification needed
- `client/src/components/ResourcesPanel.tsx` — unchanged
- `client/src/components/ToolsPanel.tsx` — unchanged
- `client/src/components/PromptsPanel.tsx` — unchanged
- `client/src/components/TaskGrid.tsx` — unchanged
- `client/src/lib/parseMarkdownTable.ts` — unchanged (reused as-is)
- `client/src/lib/taskColumns.ts` — unchanged

### Anti-Patterns to Avoid

1. **Do NOT install an LLM SDK** (e.g. `openai`, `ollama-js`, `langchain`) — use `fetch` against the OpenAI-compatible endpoint per architecture decision
2. **Do NOT add WebSocket support** — the LLM call is a single request/response, not streaming (streaming is post-MVP)
3. **Do NOT create a new context** for chat state — use local state in ChatPanel (with messages lifted to App.tsx for tab-switch persistence)
4. **Do NOT modify `DisplayContent` type** — the existing variants (`grid`, `text`, `mutated`, `loading`, `error`) cover all LLM result cases
5. **Do NOT duplicate the markdown/JSON parsing logic** — import from `lib/parseMarkdownTable.ts`
6. **Do NOT add the MCP `initialize` call in the client's `interpretMessage`** — the proxy handles its own MCP session; the browser's MCP init is separate
7. **Do NOT make the proxy maintain per-request MCP sessions** — use the single bridge for all LLM-initiated MCP operations
8. **Do NOT use `sendJsonRpc` for the `/llm/interpret` call** — it's a plain REST endpoint, not JSON-RPC
9. **Do NOT add router or navigation library** — use simple `useState` tab toggle; no React Router needed
10. **Do NOT touch existing panel components** — they continue working exactly as before under the manual tab

### Tech Stack Reference

| Item | Value |
|------|-------|
| Ollama API | OpenAI-compatible `/v1/chat/completions` at `http://localhost:11434` |
| Default model | `llama3.1` (must be pulled: `ollama pull llama3.1`) |
| Proxy | Express 5.1.0, cors 2.8.5, Node native `fetch` |
| Client | React 19.2.4, TypeScript ~5.9.3, Vite 8.0.1 |
| AG Grid | Community v35.1.0 |
| CSS | Plain CSS with CSS variables (dark theme), no Tailwind |

### Previous Story Intelligence (from Story 4.5)

- `MCP_COPY` in `mcpExplainer.ts` is imported in all panel components and `App.tsx` — established pattern for adding new keys
- `.post-action` CSS class exists and is styled — reuse for AI post-action lines
- `useDisplay()` returns `{ displayContent, setDisplayContent }` — used by all panels to show results in DetailPanel
- `parseMarkdownTable` and `parseJsonTaskArray` are the standard parsers for converting MCP results to `GridRow[]`
- The `key` prop on grid display content forces AG Grid to remount when data source changes — use `key: \`ai-${Date.now()}\`` or similar for AI results
- Panel components use `useMcp()` for catalog data — ChatPanel does NOT need `useMcp()` (capabilities are on the proxy side)

### Git Intelligence (from commits `25d2f1a` through `9dd6381`)

Recent commits show:
- Established pattern: one story = one feat commit with scope (e.g. `feat(4.5): consistent MCP terminology...`)
- `client/src/copy/mcpExplainer.ts` has been modified in multiple stories — add keys carefully, do not break existing ones
- All three panel components (`ResourcesPanel`, `ToolsPanel`, `PromptsPanel`) are stable since 4.5
- `proxy/src/index.ts` has not been modified since Story 3.1 (`604db76`) — take care when adding the new endpoint

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — LLM endpoint spec, env vars, response format
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — ChatPanel component, React state approach
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — `proxy/src/llm.ts`, `client/src/components/ChatPanel.tsx`
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — Full epic context, UX-DR10–14, FR29–32
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — Acceptance criteria source
- [Source: _bmad-output/planning-artifacts/epics.md#Stretch Goal Note] — MCP Sampling consideration (deferred for this story; proxy approach used)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-19.md] — Original feature proposal and rationale

## Dev Agent Record

### Agent Model Used

claude-4.6-opus-high-thinking

### Debug Log References

No debug issues encountered. All builds and linting passed on first attempt.

### Completion Notes List

- Created `proxy/src/llm.ts` with `interpretWithLlm()` and `gatherCapabilities()` functions. Uses Ollama's OpenAI-compatible `/v1/chat/completions` endpoint via native `fetch`. System prompt dynamically lists all MCP capabilities. Validates LLM JSON response structure with extraction support for both raw JSON and markdown-fenced JSON.
- Added `POST /llm/interpret` endpoint to `proxy/src/index.ts`. Uses lazy initialization pattern for capability gathering (first request triggers MCP initialize + list calls). Internal request IDs start at 100000 to avoid collisions with browser client IDs. Endpoint is plain REST (not JSON-RPC).
- Added `interpretMessage()`, `ChatMessage`, and `LlmInterpretResult` exports to `client/src/mcp/client.ts`. Plain REST fetch to `/llm/interpret`, no JSON-RPC wrapping, no `ensureInitialized`.
- Updated `mcpExplainer.ts`: renamed `appSubtitle` to `appSubtitleManual`, added `appSubtitleAi`, `chatBlurb`, `postActionAiRead/Call/Invoke`, `ollamaSetupHint`.
- Created `ChatPanel.tsx` with messages lifted to App.tsx for tab-switch persistence. Uses same parsing pipeline as existing panels (parseMarkdownTable, parseJsonTaskArray). Shows typing indicator with animated dots during loading. Ollama-down errors include setup hint.
- Added tab navigation to `App.tsx` with "You are the MCP Client" / "Ollama is the MCP Client" tabs. DetailPanel stays outside conditional rendering. Subtitle updates per active tab.
- Added tab bar CSS to `App.css` and chat panel CSS to `index.css`. Uses existing CSS variables only. Typing indicator uses bounce animation.
- No test framework exists in this project — verified via TypeScript build (zero errors), ESLint (zero errors), and proxy type-check (zero errors).

### File List

- `proxy/src/llm.ts` — **CREATED** — LLM interpretation module
- `proxy/src/index.ts` — **MODIFIED** — Added `/llm/interpret` endpoint, LLM imports, capability gathering
- `client/src/mcp/client.ts` — **MODIFIED** — Added `interpretMessage`, `ChatMessage`, `LlmInterpretResult` exports
- `client/src/copy/mcpExplainer.ts` — **MODIFIED** — Added chat-related copy keys, renamed `appSubtitle` to `appSubtitleManual`
- `client/src/components/ChatPanel.tsx` — **CREATED** — Chat UI component
- `client/src/App.tsx` — **MODIFIED** — Tab navigation, conditional rendering, subtitle switching
- `client/src/App.css` — **MODIFIED** — Tab bar styles
- `client/src/index.css` — **MODIFIED** — Chat panel styles

### Change Log

- 2026-03-26: Implemented Story 5.1 — Added LLM interpretation endpoint and chat UI. Created proxy LLM module with Ollama integration, added `/llm/interpret` REST endpoint, created ChatPanel component with tab navigation, updated copy and styles.
