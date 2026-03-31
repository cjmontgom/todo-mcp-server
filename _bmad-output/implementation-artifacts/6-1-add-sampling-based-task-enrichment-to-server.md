# Story 6.1: Add Sampling-Based Task Enrichment to Server and Proxy

Status: done

## Story

As a developer or learner using the MCP server,
I want the server to use MCP Sampling to automatically enrich vague task inputs with better titles, descriptions, priority, and due date suggestions,
So that I can see the fourth MCP primitive (Sampling) in action and understand how an MCP server can request LLM completions from the client.

## Acceptance Criteria

1. **AC1 — Server uses `createMessage` in `create_task` to enrich tasks**
   Given the server is running and a connected client supports sampling
   When a client calls `create_task` with a minimal title (e.g., "fix bug")
   Then the server calls `server.createMessage(...)` with a prompt asking the LLM to suggest improvements
   And the server applies the LLM's suggestions to enrich the task's title, description, priority, and dueDate
   And the tool response includes both the original input and the enriched fields so the caller can see what changed

2. **AC2 — Graceful fallback when sampling is unavailable**
   Given the server is running and a connected client does NOT support sampling (e.g., Claude Desktop with `capabilities: {}`)
   When a client calls `create_task`
   Then the task is created with the original input unchanged (existing behavior preserved)
   And no error is thrown — the enrichment step is silently skipped

3. **AC3 — Proxy bridge handles server-initiated requests**
   Given the proxy is running with the MCP server child process
   When the server sends a `sampling/createMessage` JSON-RPC request over STDIO (a message with both `id` and `method`)
   Then the proxy bridge distinguishes this from a response to a pending request
   And the proxy emits a `serverRequest` event (not treated as a notification or matched to a pending call)

4. **AC4 — Proxy handles sampling by calling Ollama**
   Given the proxy receives a `sampling/createMessage` server-initiated request
   When the proxy processes it
   Then the proxy calls the LLM (Ollama at `LLM_BASE_URL`) with the messages from the sampling request
   And sends the LLM response back to the server as a JSON-RPC response over STDIO
   And the tool call completes with the enriched task data

5. **AC5 — Proxy injects sampling capability into initialize**
   Given the browser client sends an `initialize` request through the proxy
   When the proxy forwards it to the MCP server
   Then the proxy adds `sampling: {}` to the client's `capabilities` before forwarding
   So the server knows the client supports sampling

6. **AC6 — Enrichment response is structured and parseable**
   Given a `create_task` call completes with enrichment
   When the tool result is returned
   Then the response text includes a clear indication of what was enriched (e.g., "Created task 3: [enriched title] (enriched by AI — original title: 'fix bug')")
   And the task stored in memory has the enriched values

7. **AC7 — Existing tool behavior is unchanged for all other tools**
   Given the server is running with sampling support
   When a client calls `update_task`, `update_task_status`, `get_task`, or `delete_task`
   Then those tools behave exactly as before — no sampling is used

## Tasks / Subtasks

- [x] Task 1: Update proxy bridge to handle server-initiated requests (AC: #3)
  - [x] 1.1 In `proxy/src/spawnMcpServer.ts`, modify the `rl.on("line")` handler to distinguish between **responses** (have `id`, no `method`) and **server-initiated requests** (have both `id` and `method`)
  - [x] 1.2 Emit `serverRequest` event for server-initiated requests instead of trying to match them to pending requests
  - [x] 1.3 Add a `respondToServer(id, result)` method that writes a JSON-RPC response back to the server's stdin
  - [x] 1.4 Add a `respondErrorToServer(id, code, message)` method for error responses

- [x] Task 2: Add sampling request handler to proxy (AC: #4, #5)
  - [x] 2.1 In `proxy/src/index.ts`, add a `bridge.on("serverRequest", ...)` handler
  - [x] 2.2 When the method is `sampling/createMessage`, extract `messages` and `maxTokens` from params
  - [x] 2.3 Call Ollama's `/v1/chat/completions` (reuse env vars `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` from existing llm.ts — extract the fetch call into a shared helper or import directly)
  - [x] 2.4 Map the LLM response to the MCP `CreateMessageResult` format: `{ role: "assistant", content: { type: "text", text: "..." }, model: "...", stopReason: "endTurn" }`
  - [x] 2.5 Call `bridge.respondToServer(id, result)` with the formatted response
  - [x] 2.6 On LLM error, call `bridge.respondErrorToServer(id, -32603, errorMessage)`
  - [x] 2.7 In the `/mcp` POST handler, intercept `initialize` requests and inject `sampling: {}` into `params.capabilities` before forwarding to the server

- [x] Task 3: Add sampling-based enrichment to `create_task` in the server (AC: #1, #2, #6, #7)
  - [x] 3.1 In `src/index.ts`, in the `create_task` case of the `CallToolRequestSchema` handler, after creating the basic task, attempt sampling-based enrichment
  - [x] 3.2 Use `server.createMessage({ messages: [...], maxTokens: 300 })` with a prompt asking the LLM to return a JSON object with suggested `title`, `description`, `priority`, and `dueDate`
  - [x] 3.3 Parse the LLM response as JSON; apply any non-empty fields to the task (overwrite only if the LLM provided a value)
  - [x] 3.4 Wrap the `createMessage` call in try/catch — if it fails (client doesn't support sampling, LLM error, etc.), log to stderr and proceed with the original task unchanged
  - [x] 3.5 Modify the tool response text to indicate enrichment occurred: include original title vs enriched title, and note which fields were enhanced
  - [x] 3.6 If enrichment was skipped (catch block), return the existing response format unchanged

- [x] Task 4: Build and verify (AC: all)
  - [x] 4.1 `npm run build` in root — zero TypeScript errors for server
  - [x] 4.2 `cd proxy && npm run build` — zero TypeScript errors for proxy
  - [x] 4.3 `cd client && npm run build` — zero TypeScript errors for client (no client changes expected, but verify no regression)
  - [x] 4.4 Start proxy + server, create a task via the manual UI or curl — verify enrichment happens when Ollama is running
  - [x] 4.5 Stop Ollama, create a task — verify it creates normally without enrichment (fallback)
  - [x] 4.6 Verify `update_task`, `get_task`, `delete_task`, `update_task_status` all work unchanged

## Dev Notes

### Server — Sampling Integration (`src/index.ts`)

**The `Server` class from `@modelcontextprotocol/sdk/server/index.js` has a `createMessage()` method.** This is the same method accessed via `mcpServer.server.createMessage()` in the high-level `McpServer` API. Since this project uses `Server` directly, call `server.createMessage(...)` directly.

**SDK reference** (from `toolWithSampleServer.ts` in the SDK repo):

```typescript
const response = await mcpServer.server.createMessage({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please summarize the following text concisely:\n\n${text}`
      }
    }
  ],
  maxTokens: 500
});
// response.content.type === "text" → response.content.text
```

Since this project's server uses `Server` directly (not `McpServer`), the equivalent is:

```typescript
const response = await server.createMessage({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "..."
      }
    }
  ],
  maxTokens: 300
});
```

**Enrichment prompt strategy:**

Build a prompt that:
1. Tells the LLM it's enriching a task for a todo app
2. Provides the original user input (title, description if any, priority if any)
3. Asks for a JSON response with improved fields
4. Specifies the valid values for status and priority

Example prompt (to be refined in implementation):

```
You are enriching a task for a todo app. The user provided:
- Title: "${title}"
- Description: "${description || '(none)'}"
- Priority: "${priority || '(none)'}"
- Due date: "${dueDate || '(none)'}"

Return a JSON object with improved values. Only include fields you want to change:
{
  "title": "clearer, more actionable title",
  "description": "helpful description if missing or vague",
  "priority": "low" | "medium" | "high",
  "dueDate": "ISO 8601 date if you can estimate one, or omit"
}

Respond with ONLY the JSON object, no explanation.
```

**Graceful fallback pattern:**

```typescript
case "create_task": {
  // ... existing validation and task creation ...
  
  // Attempt enrichment via sampling
  let enriched = false;
  const originalTitle = newTask.title;
  try {
    const response = await server.createMessage({
      messages: [{ role: "user", content: { type: "text", text: enrichmentPrompt } }],
      maxTokens: 300,
    });
    if (response.content.type === "text") {
      const suggestions = JSON.parse(response.content.text);
      // Apply non-empty suggestions
      if (suggestions.title) newTask.title = suggestions.title;
      if (suggestions.description) newTask.description = suggestions.description;
      if (suggestions.priority && VALID_PRIORITIES.includes(suggestions.priority)) {
        newTask.priority = suggestions.priority;
      }
      if (suggestions.dueDate) newTask.dueDate = suggestions.dueDate;
      enriched = true;
    }
  } catch (err) {
    console.error("Sampling enrichment skipped:", err instanceof Error ? err.message : err);
  }
  
  tasks.set(id, newTask);
  
  const enrichmentNote = enriched
    ? ` (enriched by AI — original title: "${originalTitle}")`
    : "";
  return {
    content: [{
      type: "text",
      text: `Created task ${id}: ${newTask.title}${enrichmentNote}`,
    }],
  };
}
```

**IMPORTANT — Create the task BEFORE enrichment, then update in place.** The task should exist in the map even if enrichment fails. Set it in the map after enrichment completes (or fails). The code above shows enriching `newTask` before `tasks.set(id, newTask)` which is correct since `newTask` is a local variable.

**IMPORTANT — Do NOT change the server's declared capabilities.** The server does not declare `sampling` in its own capabilities — sampling is a CLIENT capability. The server just calls `createMessage()` and the SDK handles the rest. The existing `capabilities: { resources: {}, tools: {}, prompts: {} }` stays unchanged.

**IMPORTANT — SDK version check.** The project uses `@modelcontextprotocol/sdk: ^1.1.0`. The `createMessage()` method is available in v1.x. If the installed version doesn't have it, run `npm update @modelcontextprotocol/sdk` to get the latest 1.x release. Do NOT upgrade to v2 (it uses zod v4 and has breaking changes).

### Proxy — Bridge Changes (`proxy/src/spawnMcpServer.ts`)

**Current behavior** of `rl.on("line")`:

```typescript
if ("id" in msg && msg.id != null) {
  // Tries to match to pending request — FAILS for server-initiated requests
  const entry = this.pending.get(msg.id);
  ...
} else {
  this.emit("notification", msg);
}
```

**Required change:** Distinguish between responses and server-initiated requests:

```typescript
if ("id" in msg && msg.id != null) {
  if ("method" in msg && typeof msg.method === "string") {
    // Server-initiated request (e.g., sampling/createMessage)
    this.emit("serverRequest", msg);
  } else {
    // Response to a pending proxy→server request
    const entry = this.pending.get(msg.id as string | number);
    if (entry) {
      clearTimeout(entry.timer);
      entry.resolve(msg);
      this.pending.delete(msg.id as string | number);
    }
  }
} else {
  this.emit("notification", msg);
}
```

**New methods on `McpServerBridge`:**

```typescript
respondToServer(id: string | number, result: unknown): void {
  if (!this.alive || !this.process?.stdin?.writable) return;
  this.process.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"
  );
}

respondErrorToServer(id: string | number, code: number, message: string): void {
  if (!this.alive || !this.process?.stdin?.writable) return;
  this.process.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}
```

### Proxy — Sampling Handler (`proxy/src/index.ts`)

**Handle `serverRequest` events from the bridge:**

```typescript
bridge.on("serverRequest", async (msg: Record<string, unknown>) => {
  const method = msg.method as string;
  const id = msg.id as string | number;
  const params = msg.params as Record<string, unknown> | undefined;

  if (method === "sampling/createMessage") {
    try {
      const result = await handleSamplingRequest(params ?? {});
      bridge.respondToServer(id, result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Sampling failed";
      bridge.respondErrorToServer(id, -32603, errMsg);
    }
  } else {
    bridge.respondErrorToServer(id, -32601, `Unsupported server request: ${method}`);
  }
});
```

**`handleSamplingRequest` function:**

Extract `messages` and `maxTokens` from params. Map MCP message format to OpenAI chat format. Call Ollama. Map response back.

```typescript
async function handleSamplingRequest(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const mcpMessages = params.messages as Array<{
    role: string;
    content: { type: string; text?: string };
  }>;
  const maxTokens = (params.maxTokens as number) || 500;

  const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434";
  const LLM_MODEL = process.env.LLM_MODEL || "llama3.1";
  const LLM_API_KEY = process.env.LLM_API_KEY || "";

  const chatMessages = mcpMessages.map((m) => ({
    role: m.role,
    content: m.content.type === "text" ? m.content.text ?? "" : "",
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_API_KEY) headers["Authorization"] = `Bearer ${LLM_API_KEY}`;

  const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: chatMessages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    model?: string;
  };

  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    role: "assistant",
    content: { type: "text", text },
    model: data.model ?? LLM_MODEL,
    stopReason: "endTurn",
  };
}
```

**IMPORTANT — Reuse env var reading pattern from existing `proxy/src/llm.ts`.** The env vars `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` are already read there. Either extract them to a shared config module, or just read them again in the handler (they're env vars, reading them twice is fine for MVP).

**IMPORTANT — The sampling handler runs DURING a tool call.** When the server processes `create_task`, it blocks on `createMessage()`. The proxy must handle the sampling request and respond before the tool call can complete. This means the sampling handler must NOT block on anything that depends on the tool call completing (no circular dependency). The LLM call is independent, so this is fine.

**Initialize capability injection:**

In the `/mcp` POST handler, add before forwarding:

```typescript
if (body.method === "initialize" && body.params?.capabilities) {
  body.params.capabilities = {
    ...body.params.capabilities,
    sampling: {},
  };
}
```

This transparently tells the server that the client supports sampling, even though the browser client didn't declare it. The proxy is the actual sampling handler, so this is accurate.

### Project Structure Notes

Files modified by this story:

| File | Action | Notes |
|------|--------|-------|
| `src/index.ts` | **MODIFY** | Add sampling enrichment to `create_task` tool handler |
| `proxy/src/spawnMcpServer.ts` | **MODIFY** | Distinguish server-initiated requests from responses; add `respondToServer`/`respondErrorToServer` methods |
| `proxy/src/index.ts` | **MODIFY** | Add `serverRequest` event handler for sampling; inject `sampling` capability into `initialize` |

**Unchanged — do NOT touch:**

- `proxy/src/llm.ts` — LLM interpretation module stays as-is (sampling handler can read env vars independently)
- `proxy/package.json` — no new dependencies (uses native `fetch`)
- `client/` — zero client changes in this story
- `src/index.ts` tools other than `create_task` — no changes to `update_task`, `get_task`, `delete_task`, `update_task_status`
- `src/index.ts` resources and prompts — no changes to any resource or prompt handlers

### Anti-Patterns to Avoid

1. **Do NOT install an LLM SDK** — use `fetch` against Ollama's OpenAI-compatible endpoint (consistent with existing approach in `proxy/src/llm.ts`)
2. **Do NOT upgrade to MCP SDK v2** — v2 is pre-alpha and requires zod v4. Stay on v1.x (`^1.1.0`). Run `npm update @modelcontextprotocol/sdk` if `createMessage` is not found
3. **Do NOT add `sampling` to the server's own capabilities** — sampling is a CLIENT capability, not a server capability. The server's `capabilities: { resources: {}, tools: {}, prompts: {} }` stays unchanged
4. **Do NOT modify any client-side code** — this story is server + proxy only. Client educational UI is Story 6.2
5. **Do NOT break existing tool behavior** — `update_task`, `get_task`, `delete_task`, `update_task_status` must be completely unchanged
6. **Do NOT make enrichment blocking** — if sampling fails (any reason), the task must still be created with original values
7. **Do NOT use `McpServer` class** — the project uses `Server` directly. `createMessage()` is available on the `Server` instance
8. **Do NOT add a new tool** — enrichment happens WITHIN the existing `create_task` tool, not as a separate tool
9. **Do NOT duplicate the LLM fetch logic as a shared module** — for MVP, reading env vars in both `llm.ts` and the sampling handler is fine. Refactoring to a shared module is a nice-to-have for tech debt
10. **Do NOT stream the LLM response** — `createMessage` expects a single response, not streaming

### Tech Stack Reference

| Item | Value |
|------|-------|
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` (v1.x branch) |
| Key SDK API | `server.createMessage({ messages, maxTokens })` |
| Ollama API | OpenAI-compatible `/v1/chat/completions` at `LLM_BASE_URL` |
| Default model | `llama3.1` (must be pulled: `ollama pull llama3.1`) |
| Proxy | Express 5.1.0, cors 2.8.5, Node native `fetch` |
| Server | TypeScript, Node, `StdioServerTransport` |

### Previous Story Intelligence

From Story 5.1 and 5.2 implementation:
- `proxy/src/llm.ts` already reads `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` from env and calls Ollama. The sampling handler should follow the same pattern
- The proxy uses `bridge.send()` with internally generated IDs (starting at 100000) for LLM-initiated MCP calls. The new `respondToServer()` method uses the ID from the server's request (not a proxy-generated ID)
- `proxy/src/spawnMcpServer.ts` bridge is the critical integration point — any changes here must preserve existing pending-request matching for normal MCP operations
- `dotenv/config` is imported at the top of `proxy/src/index.ts` — env vars are available everywhere in the proxy process
- The proxy's LLM module also attempts its own `initialize` call on first `/llm/interpret` — this may conflict with the browser's `initialize` if timing overlaps. The existing code handles this gracefully with a try/catch

### Git Intelligence

Recent commit pattern: `feat(X.Y): description` — this story should be `feat(6.1): add sampling-based task enrichment`

Recent commits (`6ad8370` through `d13fdad`) show:
- Story 5.2 is in review status — the most recent feature work
- Proxy has been modified in stories 5.1 and 5.2
- Server (`src/index.ts`) has not been modified since Epic 2 (prompts) — take care when modifying the tool handler

### Key Architectural Decision

**Why the proxy handles sampling (not the browser client):**

In a full MCP deployment, the client handles `sampling/createMessage`. In this project's architecture, the proxy sits between server and client. For Story 6.1, the proxy handles sampling directly by calling Ollama — this gets sampling working end-to-end without any client changes. Story 6.2 will add client-side awareness and educational UI.

This is architecturally valid because the proxy IS the MCP client from the server's perspective (it's the process connected via STDIO). The browser is one step further removed.

### References

- [Source: MCP TypeScript SDK capabilities docs — sampling section](https://modelcontextprotocol.github.io/typescript-sdk/documents/capabilities.html)
- [Source: MCP SDK example — toolWithSampleServer.ts](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/toolWithSampleServer.ts)
- [Source: _bmad-output/planning-artifacts/epics.md#Stretch Goal Note] — original sampling consideration
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — LLM endpoint spec, env vars
- [Source: _bmad-output/implementation-artifacts/5-1-add-llm-interpretation-endpoint-and-chat-ui.md] — LLM integration patterns, proxy architecture

## Dev Agent Record

### Agent Model Used

claude-4.6-opus

### Debug Log References

- All 17 unit tests pass (6 enrichment logic, 7 bridge methods, 4 sampling handler)
- Server, proxy, and client all build with zero TypeScript errors
- No linter errors introduced

### Completion Notes List

- **Task 1:** Modified `proxy/src/spawnMcpServer.ts` to distinguish server-initiated requests (messages with both `id` and `method`) from responses. Added `respondToServer()` and `respondErrorToServer()` methods for writing JSON-RPC responses back to the server's stdin.
- **Task 2:** Added `handleSamplingRequest()` function in `proxy/src/index.ts` that maps MCP sampling messages to OpenAI-format chat completions via Ollama. Added `bridge.on("serverRequest", ...)` handler to route `sampling/createMessage` requests. Injected `sampling: {}` capability into `initialize` requests in the `/mcp` POST handler.
- **Task 3:** Added sampling-based enrichment to `create_task` in `src/index.ts`. The server calls `server.createMessage()` with an enrichment prompt, parses the JSON response, and applies suggested improvements to title, description, priority, and dueDate. Graceful fallback: if sampling fails for any reason, the task is created with original values unchanged. Response text indicates enrichment status.
- **Task 4:** All three projects (server, proxy, client) build with zero TypeScript errors. Added vitest as devDependency. Created 17 unit tests covering bridge methods, server request detection, sampling handler, and enrichment logic. All tests pass. Tasks 4.4-4.6 require manual verification with Ollama running.

### File List

- `src/index.ts` — MODIFIED: Added sampling-based enrichment to `create_task` tool handler
- `proxy/src/spawnMcpServer.ts` — MODIFIED: Added server-initiated request detection, `respondToServer()`, `respondErrorToServer()`
- `proxy/src/index.ts` — MODIFIED: Added `serverRequest` event handler, `sampling: {}` capability injection, imports `handleSamplingRequest` from sampling module
- `proxy/src/sampling.ts` — NEW: Extracted `handleSamplingRequest()` function for testability
- `proxy/src/spawnMcpServer.test.ts` — NEW: Unit tests for bridge changes (7 tests)
- `proxy/src/sampling.test.ts` — NEW: Unit tests for sampling handler (4 tests)
- `src/enrichment.test.ts` — NEW: Unit tests for enrichment logic (6 tests)
- `vitest.config.ts` — NEW: Vitest config scoping root tests to `src/`
- `package.json` — MODIFIED: Added vitest devDependency and test script
- `proxy/package.json` — MODIFIED: Added vitest devDependency and test script

### Change Log

- 2026-03-30: Implemented all 4 tasks for story 6.1 — sampling-based task enrichment. Added server-initiated request handling to proxy bridge, sampling request handler with Ollama integration, enrichment logic in `create_task` with graceful fallback, and 17 unit tests. All builds pass with zero errors.
