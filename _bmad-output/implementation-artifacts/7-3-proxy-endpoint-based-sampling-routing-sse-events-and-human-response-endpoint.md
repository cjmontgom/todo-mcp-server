# Story 7.3: Proxy — Endpoint-Based Sampling Routing, SSE Events, and Human Response Endpoint

Status: done

## Story

As the proxy bridging server and browser,
I want to route `sampling/createMessage` to either the browser (human mode) or Ollama (AI mode) based on which endpoint triggered the tool call,
So that the two learning routes are completely independent with no cross-contamination.

## Acceptance Criteria

1. **AC1 — Human mode: `/mcp` triggers SSE `sampling-request` event, waits for browser**
   Given `create_task_using_sampling` is called via `POST /mcp` (manual tab)
   When the server emits `sampling/createMessage`
   Then the proxy stores mode = `"human"` and emits SSE event `{ type: "sampling-request", id, messages, maxTokens }` to all connected browser clients
   And waits up to 10 minutes for a browser response
   And does NOT call Ollama

2. **AC2 — AI mode: `/llm/interpret` triggers Ollama + SSE trace events**
   Given `create_task_using_sampling` is called via `POST /llm/interpret` (AI tab)
   When the server emits `sampling/createMessage`
   Then the proxy stores mode = `"ai"` and calls Ollama to fulfil the sampling request
   And emits SSE trace events: `{ type: "sampling-trace", step: "server-requested" | "calling-ollama" | "ollama-responded" | "enrichment-applied", data: {...} }`
   And does NOT emit a `sampling-request` event to the browser

3. **AC3 — Human response endpoint: valid id resolves the pending request**
   Given the browser POSTs to `POST /mcp/sampling/respond` with `{ id, response: { role, content } }`
   When a human-mode sampling request with that id is pending
   Then the proxy forwards the browser's response to the server via `bridge.respondToServer(id, response)`
   And the pending `tools/call` resolves with the enriched task
   And returns HTTP 200 `{ ok: true }`

4. **AC4 — Human response endpoint: unknown or already-resolved id returns error**
   Given the browser POSTs to `POST /mcp/sampling/respond` with an unknown or already-resolved id
   When the proxy handles the request
   Then it returns HTTP 404 with a clear message

5. **AC5 — Human-mode timeout: no browser response after 10 minutes**
   Given a human-mode sampling request exceeds the 10-minute cleanup timeout with no browser response
   When the proxy timeout fires
   Then the proxy sends an error response to the server via `respondErrorToServer`
   And no Ollama fallback occurs
   And the pending entry is cleaned up

6. **AC6 — Existing proxy tests and build remain clean**
   Given all changes are applied
   When `npm run build` runs inside `proxy/`
   Then TypeScript reports zero errors
   And `npm test` in `proxy/` passes all 8 existing `handleSamplingRequest` tests

## Tasks / Subtasks

- [x] Task 1: Extract `broadcastSSE` helper and add state variables (AC: #1, #2, #3)
  - [x] 1.1 Add `const SAMPLING_HUMAN_TIMEOUT_MS = 10 * 60 * 1000;` near the top of `proxy/src/index.ts`, after the existing `const` declarations
  - [x] 1.2 Add `let currentSamplingMode: "human" | "ai" = "human";` module-level variable (default "human")
  - [x] 1.3 Add `interface PendingSamplingRequest { resolve: (r: Record<string, unknown>) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; }` type and `const pendingSamplingRequests = new Map<string | number, PendingSamplingRequest>();` below the new state vars
  - [x] 1.4 Extract `broadcastSSE` helper function: takes `event: Record<string, unknown>`, serializes to JSON, writes `event: message\ndata: ${data}\n\n` to each `sseClients` entry (same pattern as the existing notification handler, with the `sseClients.delete(client)` guard on error)
  - [x] 1.5 Update the `bridge.on("notification")` handler to call `broadcastSSE(msg)` instead of inline iteration

- [x] Task 2: Rewrite the `bridge.on("serverRequest")` handler with mode-based routing (AC: #1, #2, #5)
  - [x] 2.1 Keep the outer structure: only handle `method === "sampling/createMessage"`, still `respondErrorToServer` for unknown methods
  - [x] 2.2 **Human-mode branch** (`currentSamplingMode === "human"`):
    - Call `broadcastSSE({ type: "sampling-request", id, messages: params?.messages, maxTokens: params?.maxTokens })`
    - Set a `NodeJS.Timeout` for `SAMPLING_HUMAN_TIMEOUT_MS` that calls `pendingSamplingRequests.delete(id)` then `bridge.respondErrorToServer(id, -32603, "Sampling request timed out — no human response received within 10 minutes")`
    - Call `pendingSamplingRequests.set(id, { resolve, reject, timer })` where `resolve` calls `clearTimeout(timer)`, `pendingSamplingRequests.delete(id)`, then `bridge.respondToServer(id, result)`, and `reject` calls `clearTimeout(timer)`, `pendingSamplingRequests.delete(id)`, then `bridge.respondErrorToServer(id, -32603, err.message)`
    - Do NOT call `handleSamplingRequest` or `bridge.respondToServer` synchronously — wait for human input
  - [x] 2.3 **AI-mode branch** (`currentSamplingMode === "ai"`):
    - `broadcastSSE({ type: "sampling-trace", step: "server-requested", data: { id, messages: params?.messages, maxTokens: params?.maxTokens } })`
    - `broadcastSSE({ type: "sampling-trace", step: "calling-ollama", data: { model: process.env.LLM_MODEL || "llama3.1" } })`
    - `const result = await handleSamplingRequest(params ?? {})` (same Ollama call as before)
    - `broadcastSSE({ type: "sampling-trace", step: "ollama-responded", data: { text: (result.content as Record<string, unknown>)?.text ?? "" } })`
    - `bridge.respondToServer(id, result)` (no change to how the server gets its answer)
    - Wrap the whole AI branch in `try/catch`; on error: `bridge.respondErrorToServer(id, -32603, errMsg)` (same error path as before)
    - Do NOT emit a `sampling-request` event

- [x] Task 3: Set `currentSamplingMode` in `/mcp` route (AC: #1)
  - [x] 3.1 In the `app.post("/mcp", ...)` handler, set `currentSamplingMode = "human";` immediately before the `await bridge.send(body)` call (after all validation/early-returns)
  - [x] 3.2 No other changes to the `/mcp` route logic

- [x] Task 4: Set `currentSamplingMode` in `/llm/interpret` route and emit `enrichment-applied` (AC: #2)
  - [x] 4.1 In the `op.type === "tool_call"` branch of `/llm/interpret`, set `currentSamplingMode = "ai";` immediately before the `await bridge.send({...tool_call...})` call
  - [x] 4.2 After the `tool_call` `bridge.send` resolves, if `op.params.name === "create_task_using_sampling"`, emit: `broadcastSSE({ type: "sampling-trace", step: "enrichment-applied", data: { result: (mcpResult as Record<string, unknown>) } })`
  - [x] 4.3 For all other operation types (`resource_read`, `prompt_get`), set `currentSamplingMode = "human";` before their respective `bridge.send` calls (defensive reset)

- [x] Task 5: Add `POST /mcp/sampling/respond` endpoint (AC: #3, #4)
  - [x] 5.1 Add route `app.post("/mcp/sampling/respond", (req, res) => { ... })` after the `/mcp` route and before the `/sse` route
  - [x] 5.2 Parse `{ id, response }` from `req.body`; return HTTP 400 if `id == null` or `!response`
  - [x] 5.3 Look up `pendingSamplingRequests.get(id)`: if not found → HTTP 404 `{ error: \`No pending sampling request with id ${id}\` }`
  - [x] 5.4 If found: call `pending.resolve(response as Record<string, unknown>)` and return HTTP 200 `{ ok: true }`

- [x] Task 6: Update startup console log and build/test (AC: #6)
  - [x] 6.1 Add `POST /mcp/sampling/respond — Human-in-the-loop sampling response` to the startup `console.log` block
  - [x] 6.2 Run `cd proxy && npm run build` — zero TypeScript errors
  - [x] 6.3 Run `cd proxy && npm test` — all 8 `handleSamplingRequest` tests pass

## Dev Notes

### Only File That Changes

| File | Action |
|------|--------|
| `proxy/src/index.ts` | All changes in this story |

### Files to NOT Touch

| File | Reason |
|------|--------|
| `proxy/src/sampling.ts` | `handleSamplingRequest` is reused unchanged in the AI branch |
| `proxy/src/sampling.test.ts` | All 8 tests must pass with zero changes |
| `proxy/src/spawnMcpServer.ts` | `McpServerBridge` is correct as-is; `respondToServer` and `respondErrorToServer` already exist |
| `src/index.ts` | Server changes were Story 7.2 — do NOT touch |
| `client/` | Client changes are Stories 7.5 and 7.6 |

### New Module-Level State

Add these immediately after the existing `let capabilitiesPromise` declaration:

```typescript
const SAMPLING_HUMAN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let currentSamplingMode: "human" | "ai" = "human";

interface PendingSamplingRequest {
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}
const pendingSamplingRequests = new Map<string | number, PendingSamplingRequest>();
```

### Extract `broadcastSSE` Helper

The existing `bridge.on("notification")` handler inlines the SSE write loop. Extract it into a reusable function and update the notification handler to call it:

```typescript
function broadcastSSE(event: Record<string, unknown>): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    try {
      client.write(`event: message\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}
```

The `bridge.on("notification")` handler becomes:
```typescript
bridge.on("notification", (msg: unknown) => {
  broadcastSSE(msg as Record<string, unknown>);
});
```

### Complete Rewritten `bridge.on("serverRequest")` Handler

```typescript
bridge.on("serverRequest", async (msg: Record<string, unknown>) => {
  const method = msg.method as string;
  const id = msg.id as string | number;
  const params = msg.params as Record<string, unknown> | undefined;

  if (method === "sampling/createMessage") {
    if (currentSamplingMode === "human") {
      // Human-in-the-loop: emit SSE, wait for browser response
      broadcastSSE({
        type: "sampling-request",
        id,
        messages: params?.messages,
        maxTokens: params?.maxTokens,
      });

      const timer = setTimeout(() => {
        pendingSamplingRequests.delete(id);
        bridge.respondErrorToServer(
          id,
          -32603,
          "Sampling request timed out — no human response received within 10 minutes"
        );
      }, SAMPLING_HUMAN_TIMEOUT_MS);

      pendingSamplingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          pendingSamplingRequests.delete(id);
          bridge.respondToServer(id, result);
        },
        reject: (err) => {
          clearTimeout(timer);
          pendingSamplingRequests.delete(id);
          bridge.respondErrorToServer(id, -32603, err.message);
        },
        timer,
      });
    } else {
      // AI mode: call Ollama + emit trace events
      broadcastSSE({
        type: "sampling-trace",
        step: "server-requested",
        data: { id, messages: params?.messages, maxTokens: params?.maxTokens },
      });
      broadcastSSE({
        type: "sampling-trace",
        step: "calling-ollama",
        data: { model: process.env.LLM_MODEL || "llama3.1" },
      });

      try {
        const result = await handleSamplingRequest(params ?? {});
        broadcastSSE({
          type: "sampling-trace",
          step: "ollama-responded",
          data: { text: (result.content as Record<string, unknown>)?.text ?? "" },
        });
        bridge.respondToServer(id, result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Sampling failed";
        console.error(`[sampling] Error: ${errMsg}`);
        bridge.respondErrorToServer(id, -32603, errMsg);
      }
    }
  } else {
    bridge.respondErrorToServer(id, -32601, `Unsupported server request: ${method}`);
  }
});
```

### Mode Setting in `/mcp` Route

In `app.post("/mcp", ...)`, set mode immediately before the final `bridge.send`:

```typescript
// Just before: const response = await bridge.send(body);
currentSamplingMode = "human";
const response = await bridge.send(body);
```

The exact insertion point is after the `if (body.method === "initialize")` block and inside the outer `try { ... }`.

### Mode Setting and Enrichment Trace in `/llm/interpret` Route

The `op.type === "tool_call"` branch currently:
```typescript
mcpResult = await bridge.send({ ...tool_call... });
```

Becomes:
```typescript
currentSamplingMode = "ai";
mcpResult = await bridge.send({
  jsonrpc: "2.0",
  id: nextInternalId(),
  method: "tools/call",
  params: { name: op.params.name, arguments: toObj(op.params.arguments) },
});
if (op.params.name === "create_task_using_sampling") {
  broadcastSSE({
    type: "sampling-trace",
    step: "enrichment-applied",
    data: { result: mcpResult as Record<string, unknown> },
  });
}
```

For defensive correctness, also reset mode to "human" before the `resource_read` and `prompt_get` sends:
```typescript
} else if (op.type === "resource_read") {
  currentSamplingMode = "human";
  mcpResult = await bridge.send({ ... });
} else if (op.type === "prompt_get") {
  currentSamplingMode = "human";
  mcpResult = await bridge.send({ ... });
}
```

### Complete `POST /mcp/sampling/respond` Route

Insert this between the `/mcp` route and the `/sse` route:

```typescript
app.post("/mcp/sampling/respond", (req, res) => {
  const { id, response } = req.body as {
    id?: string | number;
    response?: Record<string, unknown>;
  };

  if (id == null || !response) {
    res.status(400).json({ error: "Missing required fields: id, response" });
    return;
  }

  const pending = pendingSamplingRequests.get(id);
  if (!pending) {
    res
      .status(404)
      .json({ error: `No pending sampling request with id ${id}` });
    return;
  }

  pending.resolve(response);
  res.json({ ok: true });
});
```

### Updated Startup Console Log

```typescript
console.log(`MCP proxy listening on http://localhost:${PORT}`);
console.log(`  POST /mcp                    — JSON-RPC endpoint (human mode)`);
console.log(`  POST /mcp/sampling/respond   — Human-in-the-loop sampling response`);
console.log(`  POST /llm/interpret          — LLM interpretation endpoint (AI mode)`);
console.log(`  GET  /sse                    — Server-Sent Events`);
console.log(`  GET  /health                 — Health check`);
```

### SSE Event Format Reference

All SSE events use `event: message` with data as JSON (existing convention):

**Human mode — sampling request event:**
```json
{
  "type": "sampling-request",
  "id": 1,
  "messages": [{ "role": "user", "content": { "type": "text", "text": "..." } }],
  "maxTokens": 300
}
```

**AI mode — trace events (emitted sequentially):**
```json
{ "type": "sampling-trace", "step": "server-requested", "data": { "id": 1, "messages": [...], "maxTokens": 300 } }
{ "type": "sampling-trace", "step": "calling-ollama",   "data": { "model": "llama3.1" } }
{ "type": "sampling-trace", "step": "ollama-responded", "data": { "text": "{\"title\": \"...\"}" } }
{ "type": "sampling-trace", "step": "enrichment-applied", "data": { "result": { ...mcpResult... } } }
```

### `POST /mcp/sampling/respond` Request/Response Contract

**Request body:**
```json
{
  "id": 1,
  "response": {
    "role": "assistant",
    "content": { "type": "text", "text": "{\"title\": \"Enriched title\", \"description\": \"...\"}" }
  }
}
```

**Success (200):**
```json
{ "ok": true }
```

**Not found (404):**
```json
{ "error": "No pending sampling request with id 1" }
```

**Bad request (400):**
```json
{ "error": "Missing required fields: id, response" }
```

### Mode Variable Concurrency Note

`currentSamplingMode` is a module-level variable. Since Node.js is single-threaded and the MCP server processes STDIO messages sequentially, a new `sampling/createMessage` only arrives while one `bridge.send()` is awaited. The mode is always set before that `bridge.send()` call, so the `serverRequest` handler sees the correct mode for that tool call.

This is safe for single-user local development (the intended scope). Document in comments if/when a concurrent multi-user scenario arises (would require a per-request-ID mode map instead).

### Why NOT Introduce a New File

`handleSamplingRequest` stays in `proxy/src/sampling.ts` and is simply called from the AI branch. There is no need to create a new file. All routing logic belongs in `proxy/src/index.ts` where the endpoint context is known.

### What the Tests Cover (Do NOT Break)

`proxy/src/sampling.test.ts` tests `handleSamplingRequest` in isolation:
- Maps MCP messages → OpenAI format and returns MCP result
- Throws on non-ok HTTP response
- Uses `LLM_API_KEY` in Authorization header when set
- Defaults `maxTokens` to 500 when not provided
- Preserves `maxTokens: 0` (does not coerce to 500)
- Throws when `messages` is missing
- Throws when `messages` is not an array
- Throws on unexpected LLM response shape
- Handles message with missing content gracefully

None of these tests touch `proxy/src/index.ts`. Changing `index.ts` cannot break them. Run `cd proxy && npm test` to confirm.

### Previous Story Context

**Story 7.2 (done)** added `create_task_using_sampling` to the MCP server. The proxy in 7.2 was intentionally left unchanged — it routes ALL `sampling/createMessage` to Ollama. Story 7.3 is where the routing split happens.

**Note from 7.2 Dev Notes:** "Proxy routes all `sampling/createMessage` to Ollama — this is correct for 7.2; routing changes are in 7.3." This is the exact file and location to change.

**Story 7.4 (next):** Updates `proxy/src/llm.ts` system prompt so Ollama auto-selects `create_task_using_sampling` for underspecified tasks. No proxy routing changes in 7.4.

**Stories 7.5 and 7.6 (client):** Consume the `sampling-request` and `sampling-trace` SSE events added in this story. The SSE event formats defined here are the contract those stories depend on.

### Existing `McpServerBridge` API (Do Not Modify)

```typescript
// spawnMcpServer.ts — these methods already exist, use them as-is:
bridge.respondToServer(id, result)         // Sends { jsonrpc: "2.0", id, result } to server stdin
bridge.respondErrorToServer(id, code, msg) // Sends { jsonrpc: "2.0", id, error: { code, message } }
```

### Git Commit Style

```
feat(7.3): proxy endpoint-based sampling routing, SSE events, human response endpoint
```

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking

### Debug Log References

### Completion Notes List

- Implemented all 6 tasks in `proxy/src/index.ts` as specified in the story.
- Task 1: Added `SAMPLING_HUMAN_TIMEOUT_MS`, `currentSamplingMode`, `PendingSamplingRequest` interface, `pendingSamplingRequests` Map, and extracted `broadcastSSE` helper. Updated `bridge.on("notification")` to use `broadcastSSE`.
- Task 2: Rewrote `bridge.on("serverRequest")` handler with human/AI mode branching. Human mode emits `sampling-request` SSE event and stores a `PendingSamplingRequest` with a 10-minute timeout. AI mode calls `handleSamplingRequest` and emits four `sampling-trace` SSE events (`server-requested`, `calling-ollama`, `ollama-responded`). Unknown methods still call `respondErrorToServer`.
- Task 3: Set `currentSamplingMode = "human"` immediately before `bridge.send(body)` in `POST /mcp`.
- Task 4: Set `currentSamplingMode = "ai"` before `bridge.send` in the `tool_call` branch of `POST /llm/interpret`; emits `enrichment-applied` trace when tool is `create_task_using_sampling`. Defensively resets to `"human"` before `resource_read` and `prompt_get` sends.
- Task 5: Added `POST /mcp/sampling/respond` endpoint between `/mcp` and `/sse`. Returns 400 for missing fields, 404 for unknown id, 200 `{ ok: true }` on success.
- Task 6: Updated startup console.log to include the new route. `npm run build` passed with zero TypeScript errors. `npm test` passed all 16 tests (8 `handleSamplingRequest` + 8 index route tests).

### File List

- `proxy/src/index.ts` (modified)

## Change Log

- 2026-04-02: Implemented story 7.3 — endpoint-based sampling routing, broadcastSSE helper, human-mode SSE events with 10-min timeout, AI-mode Ollama trace events, POST /mcp/sampling/respond endpoint. All ACs satisfied. Build clean, all 16 tests pass. Status set to review.
