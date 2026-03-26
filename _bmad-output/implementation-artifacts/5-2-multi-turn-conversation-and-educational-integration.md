# Story 5.2: Multi-turn Conversation and Educational Integration

Status: review

## Story

As a learner using the chat interface,
I want to have a back-and-forth conversation where follow-up requests build on previous context,
So that I can explore task data naturally and learn how AI agents maintain context across MCP interactions.

## Acceptance Criteria

1. **AC1 — Follow-up requests use conversation context**
   Given the user has already asked "show me all tasks" and received a result
   When the user types "now filter to just the high priority ones"
   Then the LLM receives the conversation history, understands the follow-up context, selects the appropriate MCP operation, and the chat panel shows the refined result (FR32)

2. **AC2 — Full conversation history is scrollable**
   Given a conversation is in progress
   When the user scrolls the chat area
   Then the full conversation history (user messages, AI explanations, and previous results) is visible and scrollable (UX-DR10)

3. **AC3 — Tool calls from chat show educational note about Tools vs Resources**
   Given the user asks the AI to create or update a task (e.g. "create a task called Review PR due next Friday")
   When the LLM identifies this as a tool call (`create_task` or `update_task`)
   Then the AI executes the tool, shows confirmation with the educational note "The AI called the create_task Tool — Tools change server state, unlike Resources which are read-only." (UX-DR11)

4. **AC4 — Non-MCP requests handled gracefully**
   Given the user asks a question the LLM cannot map to any MCP operation (e.g. "what's the weather?")
   When the LLM responds
   Then the AI explains that this MCP server only supports task management operations and suggests what the user can ask about

5. **AC5 — Tab switching preserves conversation and DetailPanel**
   Given the two-tab left column is rendered ("You are the MCP Client" / "Ollama is the MCP Client")
   When the user switches between tabs
   Then the left column swaps between the manual panels and the ChatPanel; the right-column DetailPanel retains or updates its content based on the most recent MCP operation from either tab; conversation history in the ChatPanel persists across tab switches; the user can freely alternate between manual and AI-mediated MCP interaction (UX-DR14)

## Tasks / Subtasks

- [x] Task 1: Enhance system prompt for multi-turn context and non-MCP handling (`proxy/src/llm.ts`) (AC: #1, #4)
  - [x] 1.1 Update `buildSystemPrompt` to add a paragraph instructing the LLM to use conversation history for follow-up references (e.g. "the user may say 'filter those' or 'now sort by deadline' — infer the intended operation from prior context")
  - [x] 1.2 Add instruction for non-MCP requests: when the user asks something unrelated to task management, respond with `operation.type: "none"` and an explanation that this server handles task management only, with 2–3 concrete suggestions of what the user can ask
  - [x] 1.3 Add `"none"` to the JSON format specification in the system prompt: `"type": "resource_read" | "tool_call" | "prompt_get" | "none"`
  - [x] 1.4 For `"none"` type, document that `params` should be `{}` (empty object)

- [x] Task 2: Update operation validation and types (`proxy/src/llm.ts`) (AC: #4)
  - [x] 2.1 Add `"none"` to the `LlmOperation["type"]` union: `"resource_read" | "tool_call" | "prompt_get" | "none"`
  - [x] 2.2 Update `validTypes` array in `validateOperation` to include `"none"`
  - [x] 2.3 No param validation needed for `"none"` type (skip the uri/name checks)

- [x] Task 3: Handle `"none"` operation in proxy endpoint (`proxy/src/index.ts`) (AC: #4)
  - [x] 3.1 In the `/llm/interpret` handler, after `interpretWithLlm` returns, check if `op.type === "none"`
  - [x] 3.2 If `"none"`, skip the MCP bridge call entirely — return `{ explanation: intent.explanation, operation: intent.operation, mcpResult: null }` immediately
  - [x] 3.3 Existing `resource_read` / `tool_call` / `prompt_get` branches remain unchanged

- [x] Task 4: Update client types for optional mcpResult (`client/src/mcp/client.ts`) (AC: #4)
  - [x] 4.1 Change `LlmInterpretResult.mcpResult` type from `unknown` to `unknown | null` (or keep `unknown` since `null` is assignable to `unknown` — just ensure the ChatPanel handles `null`)

- [x] Task 5: Handle conversational responses in ChatPanel (`client/src/components/ChatPanel.tsx`) (AC: #1, #4)
  - [x] 5.1 In `handleSubmit`, after receiving the result, check if `result.operation.type === "none"` or `result.mcpResult === null`
  - [x] 5.2 If `"none"`: add the assistant message with `result.explanation` but do NOT call `setDisplayContent` — leave the DetailPanel showing its current content
  - [x] 5.3 If an MCP operation was executed: continue with the existing `displayMcpResult` flow (no changes to existing logic)

- [x] Task 6: Add educational copy for multi-turn and non-MCP responses (`client/src/copy/mcpExplainer.ts`) (AC: #3, #4)
  - [x] 6.1 Add `multiTurnNote: "The AI used your conversation history to understand the follow-up — this is how AI agents maintain context across multiple MCP interactions."` — used optionally in chat responses when the LLM clearly references prior context
  - [x] 6.2 Verify existing `postActionAiCall` copy matches AC3 educational intent ("Tools change server state, unlike Resources which are read-only") — current copy already conveys this; no change needed unless exact wording is required

- [x] Task 7: Build and verify (AC: all)
  - [x] 7.1 `cd proxy && npm run build` — zero TypeScript errors
  - [x] 7.2 `cd client && npm run build` — zero TypeScript errors
  - [x] 7.3 `cd client && npm run lint` — zero ESLint errors
  - [ ] 7.4 Manual tab works identically to pre-story behavior (no regression)
  - [ ] 7.5 AI tab: type "show me all tasks" → get result in grid → type "now show just the high priority ones" → LLM uses context → new result in grid
  - [ ] 7.6 AI tab: type "what's the weather?" → LLM returns helpful fallback explanation, no grid update
  - [ ] 7.7 AI tab: type "create a task called Test Due Tomorrow" → tool call → educational note in chat → mutated result in DetailPanel
  - [ ] 7.8 Switch between manual and AI tabs → conversation history persists → DetailPanel retains last content
  - [ ] 7.9 Scroll through a multi-message conversation — all messages visible and scrollable

## Dev Notes

### Scope Clarification — What is NEW vs Already Done in Story 5.1

Most of the chat infrastructure was built in Story 5.1. This story focuses on three specific enhancements:

1. **System prompt enhancement for multi-turn follow-ups** — The LLM already receives `history` but the system prompt doesn't instruct it to interpret follow-up references. Without this, "now filter those" won't work reliably.
2. **Non-MCP request handling** — Currently the LLM is forced to always return an MCP operation. If the user asks something unrelated, it either hallucinates an operation or crashes. We need a `"none"` operation type.
3. **Client handling for `"none"` responses** — ChatPanel must skip the DetailPanel update when no MCP operation was executed.

**Already working from 5.1 (do NOT reimplement):**
- Conversation history lifted to `App.tsx` state and passed as props to ChatPanel ✓
- History passed to LLM via `/llm/interpret` endpoint ✓
- Scrollable conversation area with user/assistant message styling ✓
- Tab switching preserves conversation and DetailPanel ✓
- Educational notes for AI resource reads, tool calls, and prompt invocations ✓
- Loading indicator and error handling in ChatPanel ✓
- Subtitle changes per tab ✓

### Proxy — System Prompt Changes (`proxy/src/llm.ts`)

**Current system prompt** (in `buildSystemPrompt`): Instructs the LLM to choose an MCP operation and respond with JSON `{ explanation, operation }`. The prompt says "Respond ONLY with a JSON object" and only lists `resource_read`, `tool_call`, `prompt_get` as valid types.

**Required changes:**

Add after the current operation format documentation, BEFORE the closing instruction line:

```
When the user references previous messages or results (e.g. "filter those", "now sort by deadline", "show me more details"), use the conversation history to determine what data or operation they are referring to. Choose the most appropriate MCP operation that fulfills their refined request.

If the user's request cannot be mapped to any task management MCP operation (e.g. "what's the weather?", "tell me a joke"), respond with:
{
  "explanation": "A helpful message explaining this server manages tasks and suggesting 2-3 things the user can ask about",
  "operation": { "type": "none", "params": {} }
}
```

And update the type documentation line from:
```
"type": "resource_read" | "tool_call" | "prompt_get",
```
to:
```
"type": "resource_read" | "tool_call" | "prompt_get" | "none",
```

**Update `LlmOperation` type:** Add `"none"` to the union.

**Update `validateOperation`:** Add `"none"` to `validTypes` array. The `"none"` type has no required params, so skip the uri/name validation for it.

### Proxy — Endpoint Changes (`proxy/src/index.ts`)

**Current flow:** `interpretWithLlm` → always execute MCP operation → return result.

**Change:** After `interpretWithLlm` returns, check `op.type`. If `"none"`, short-circuit:

```typescript
if (op.type === "none") {
  res.json({
    explanation: intent.explanation,
    operation: intent.operation,
    mcpResult: null,
  });
  return;
}
```

Insert this check BEFORE the existing `if (op.type === "resource_read")` block. The `else` clause at the bottom that throws for unexpected types should remain for defensive safety but will never fire for `"none"`.

### Client — ChatPanel Changes (`client/src/components/ChatPanel.tsx`)

**Current flow in `handleSubmit`:** After receiving result from `interpretMessage`, it always calls `displayMcpResult(result)` which updates the DetailPanel.

**Change:** Before calling `displayMcpResult`, check if this is a conversational-only response:

```typescript
if (result.operation?.type === "none" || result.mcpResult === null) {
  // Conversational response — don't update DetailPanel
  // The assistant message with explanation is already added to chat
} else {
  displayMcpResult(result);
}
```

The educational note logic in `getEducationalNote` already returns `null` for unknown operation types, so the assistant message will just contain the explanation text for `"none"` operations.

### Client — No Changes Needed to `LlmInterpretResult`

The `mcpResult: unknown` type already accepts `null` since `null` extends `unknown` in TypeScript. No type change needed. The ChatPanel just needs to check for `null` before calling `displayMcpResult`.

### Client — Copy Changes (`client/src/copy/mcpExplainer.ts`)

Add one new key:

```typescript
multiTurnNote: "The AI used your conversation history to understand the follow-up — this is how AI agents maintain context across multiple MCP interactions.",
```

This key is available for future use (e.g., when the LLM's explanation references prior context). It is NOT automatically appended to every response — use only when contextually appropriate.

### Project Structure Notes

Files modified by this story:

| File | Action | Notes |
|------|--------|-------|
| `proxy/src/llm.ts` | **MODIFY** | System prompt enhancement, `"none"` type in union and validation |
| `proxy/src/index.ts` | **MODIFY** | Short-circuit for `"none"` operation (skip MCP bridge call) |
| `client/src/components/ChatPanel.tsx` | **MODIFY** | Skip `displayMcpResult` for `"none"` operations |
| `client/src/copy/mcpExplainer.ts` | **MODIFY** | Add `multiTurnNote` key |

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server) — zero changes
- `proxy/src/spawnMcpServer.ts` — bridge code unchanged
- `proxy/package.json` — no new dependencies
- `client/package.json` — no new dependencies
- `client/src/mcp/client.ts` — types already accommodate `null` mcpResult
- `client/src/context/McpContext.tsx` — unchanged
- `client/src/context/DisplayContext.tsx` — `DisplayContent` type unchanged
- `client/src/components/DetailPanel.tsx` — unchanged
- `client/src/components/ResourcesPanel.tsx` — unchanged
- `client/src/components/ToolsPanel.tsx` — unchanged
- `client/src/components/PromptsPanel.tsx` — unchanged
- `client/src/components/TaskGrid.tsx` — unchanged
- `client/src/App.tsx` — tab navigation already complete from 5.1
- `client/src/App.css` — tab bar styles already complete from 5.1
- `client/src/index.css` — chat panel styles already complete from 5.1
- `client/src/lib/parseMarkdownTable.ts` — unchanged
- `client/src/lib/taskColumns.ts` — unchanged

### Anti-Patterns to Avoid

1. **Do NOT reimplement conversation history management** — messages are already lifted to `App.tsx` state (Story 5.1); do not move them to a context or redux store
2. **Do NOT install an LLM SDK** — `fetch` against the OpenAI-compatible endpoint per architecture decision
3. **Do NOT modify the `DisplayContent` type** — the existing variants handle all cases including `"none"` (just skip the update)
4. **Do NOT add streaming/WebSocket support** — single request/response; streaming is post-MVP
5. **Do NOT duplicate markdown/JSON parsing** — the existing `parseMarkdownTable` and `parseJsonTaskArray` in `lib/` are the only parsers
6. **Do NOT change the `/llm/interpret` request format** — `{ message, history }` is unchanged; the response gains `mcpResult: null` for `"none"` operations
7. **Do NOT refactor ChatPanel's `displayMcpResult`** — add a guard clause before calling it, not a rewrite
8. **Do NOT create new components** — all UI work is modifications to existing ChatPanel
9. **Do NOT change how history is sent to the proxy** — the current approach of sending `{ role, content }` pairs from displayed messages works; the LLM sees the user's messages and its own explanations, which provides sufficient context for follow-ups
10. **Do NOT touch `App.tsx`** — tab navigation, subtitle switching, and chat message lifting are all complete from 5.1

### Tech Stack Reference

| Item | Value |
|------|-------|
| Ollama API | OpenAI-compatible `/v1/chat/completions` at `http://localhost:11434` |
| Default model | `llama3.1` (must be pulled: `ollama pull llama3.1`) |
| Proxy | Express 5.1.0, cors 2.8.5, Node native `fetch` |
| Client | React 19.2.4, TypeScript ~5.9.3, Vite 8.0.1 |
| AG Grid | Community v35.1.0 |
| CSS | Plain CSS with CSS variables (dark theme), no Tailwind |

### Previous Story Intelligence (from Story 5.1)

Key patterns and learnings from implementing 5.1:

- **`interpretWithLlm` signature:** `(message, history, capabilities) → Promise<LlmInterpretResponse>` — history is already threaded through; the system prompt needs the enhancement, not the function signature
- **`buildSystemPrompt` structure:** A single template string with `${resourceList}`, `${toolList}`, `${promptList}` interpolations. Append the multi-turn and non-MCP instructions before the closing paragraph
- **`validateOperation` pattern:** Checks `typeof` on each required field based on operation type. For `"none"`, just skip the param-specific checks (no `uri` or `name` needed)
- **Proxy endpoint pattern:** The `/llm/interpret` handler does `interpretWithLlm` → execute MCP → return. Insert the `"none"` short-circuit between these two steps
- **ChatPanel `handleSubmit` flow:** `await interpretMessage` → `getEducationalNote` → `displayMcpResult`. Insert the `"none"` guard between educational note and display
- **`getEducationalNote` returns `null` for unknown types** — so `"none"` operations naturally get no educational note, and the assistant message contains only the explanation
- **Error-filtered history:** ChatPanel filters out error messages from history before sending to proxy: `.filter((m) => !m.error)`. This is correct and should not change
- **No test framework exists** — verify via TypeScript build (zero errors), ESLint (zero errors), and manual testing

### Git Intelligence

Recent commit pattern: `feat(5.1): add LLM interpretation endpoint and chat UI` — follow the same scope style: `feat(5.2): multi-turn conversation and non-MCP request handling`

Files modified in 5.1 that this story also modifies:
- `proxy/src/llm.ts` (created in 5.1, modified here)
- `proxy/src/index.ts` (modified in 5.1, modified here)
- `client/src/components/ChatPanel.tsx` (created in 5.1, modified here)
- `client/src/copy/mcpExplainer.ts` (modified in 5.1, modified here)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — Acceptance criteria source
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — Epic context, UX-DR10–14, FR29–32
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — LLM endpoint spec, response format
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — ChatPanel component, React state approach
- [Source: _bmad-output/planning-artifacts/prd.md#FR32] — Multi-turn conversation history requirement
- [Source: _bmad-output/implementation-artifacts/5-1-add-llm-interpretation-endpoint-and-chat-ui.md] — Previous story implementation details and patterns

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus-high-thinking (via Cursor)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Task 1: Enhanced `buildSystemPrompt` in `proxy/src/llm.ts` with multi-turn follow-up instructions (telling the LLM to use conversation history for references like "filter those") and non-MCP request handling instructions (respond with `"none"` type and helpful suggestions). Updated the JSON format spec to include `"none"` type with `{}` params.
- Task 2: Added `"none"` to `LlmOperation["type"]` union and `validTypes` array in `validateOperation`. No param validation needed for `"none"` type.
- Task 3: Added short-circuit in `/llm/interpret` handler: when `op.type === "none"`, returns `{ explanation, operation, mcpResult: null }` without calling the MCP bridge. Inserted before existing operation branches.
- Task 4: Verified `LlmInterpretResult.mcpResult: unknown` already accepts `null` in TypeScript — no type change needed. ChatPanel handles `null` via guard clause.
- Task 5: Added guard clause in `ChatPanel.handleSubmit` before `displayMcpResult`: if `result.operation?.type === "none"` or `result.mcpResult === null`, the assistant message is shown but the DetailPanel is not updated.
- Task 6: Added `multiTurnNote` key to `MCP_COPY` in `mcpExplainer.ts`. Verified existing `postActionAiCall` copy already conveys the Tools vs Resources educational distinction — no change needed.
- Task 7: All three build/lint checks pass with zero errors: `proxy build`, `client build`, `client lint`. Manual verification subtasks (7.4–7.9) require Ollama running and are deferred to manual testing.

### Change Log

- feat(5.2): multi-turn conversation and non-MCP request handling (Date: 2026-03-26)

### File List

- `proxy/src/llm.ts` — MODIFIED: system prompt enhancement, `"none"` type in LlmOperation union and validateOperation
- `proxy/src/index.ts` — MODIFIED: short-circuit for `"none"` operation (skip MCP bridge call)
- `client/src/components/ChatPanel.tsx` — MODIFIED: guard clause to skip displayMcpResult for `"none"` operations
- `client/src/copy/mcpExplainer.ts` — MODIFIED: added `multiTurnNote` educational copy key
