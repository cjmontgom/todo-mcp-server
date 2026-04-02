# Story 7.2: Add `create_task_using_sampling` Tool to Server

Status: done

## Story

As a learner using the MCP Tools panel,
I want a dedicated `create_task_using_sampling` tool that always requires sampling,
So that I always get a meaningful enrichment result and can see the sampling flow in action.

## Acceptance Criteria

1. **AC1 — Tool calls `server.createMessage()` and enriches on success**
   Given a client that supports sampling calls `create_task_using_sampling` with a title
   When the server executes the tool
   Then it calls `server.createMessage(...)` with an enrichment prompt
   And applies the LLM response via `applyEnrichment` to enrich task fields
   And the response text is `Created task {id}: {enriched-title} (enriched by AI — field: "original" → "enriched", ...)`
   And the task is stored with the enriched values

2. **AC2 — Fails loudly when client does not support sampling**
   Given a client that does NOT support sampling calls `create_task_using_sampling`
   When the server tries to call `server.createMessage(...)`
   Then the tool returns `isError: true` with a message explaining sampling capability is required
   And no task is created

3. **AC3 — Fails loudly on timeout**
   Given sampling is available but times out (Ollama unreachable, slow response)
   When the timeout fires
   Then the tool returns `isError: true` with the message `"Sampling timed out — task not created"`
   And no task is created

4. **AC4 — Fails loudly on unparseable or empty LLM response**
   Given sampling completes but the LLM returns non-JSON, a JSON array, a JSON primitive, or an empty object `{}`
   When `applyEnrichment` processes the response
   Then the tool returns `isError: true` with the message `"Sampling returned no usable enrichment — task not created"`
   And no task is created with unenriched data

5. **AC5 — Tool description signals sampling requirement**
   Given the tool listing returned by `tools/list`
   When a client reads the tool description
   Then the description states this tool requires sampling capability and is intended for the manual "You are the MCP client" learning flow

6. **AC6 — `create_task` is completely unaffected**
   Given all changes in this story are applied
   When any existing tool (`create_task`, `update_task`, `update_task_status`, `get_task`, `delete_task`) executes
   Then behaviour is identical to after Story 7.1

7. **AC7 — Build is clean and all existing tests pass**
   Given the changes are applied
   When `npm run build` runs from the repo root
   Then TypeScript reports zero errors
   And `npm test` passes all 12 existing enrichment unit tests

## Tasks / Subtasks

- [x] Task 1: Add `create_task_using_sampling` to the tools list in `src/index.ts` (AC: #5)
  - [x] 1.1 In the `ListToolsRequestSchema` handler, append a new tool entry after the `delete_task` entry
  - [x] 1.2 Use the exact tool name `create_task_using_sampling`
  - [x] 1.3 Set description: `"Create a new task with AI-powered enrichment via MCP sampling. Requires the client to support the sampling capability. Intended for the 'You are the MCP client' manual learning flow."`
  - [x] 1.4 Define `inputSchema` with `title` as the only required field; `description`, `priority`, `dueDate` as optional (same types as `create_task`)

- [x] Task 2: Add `SAMPLING_TOOL_TIMEOUT_MS` constant near top of `src/index.ts` (AC: #3)
  - [x] 2.1 Add `const SAMPLING_TOOL_TIMEOUT_MS = 15_000;` directly below the import block (before the `Task` interface)

- [x] Task 3: Add `applyEnrichment` back to the import from `./enrichment.js` (AC: #1)
  - [x] 3.1 Change `import { VALID_PRIORITIES } from "./enrichment.js";` to `import { applyEnrichment, VALID_PRIORITIES } from "./enrichment.js";`

- [x] Task 4: Add `case "create_task_using_sampling":` handler in the `CallToolRequestSchema` switch (AC: #1–#4)
  - [x] 4.1 Add the new case after `case "create_task":` (before `case "update_task":`)
  - [x] 4.2 Validate that `title` is a non-empty string (same guard as `create_task`)
  - [x] 4.3 Construct a `newTask` object (do NOT call `tasks.set` yet — the task must not be stored until enrichment succeeds)
  - [x] 4.4 Capture `original` snapshot of `{ title, description, priority, dueDate }` before calling sampling
  - [x] 4.5 Build the enrichment prompt string (see Dev Notes for exact prompt)
  - [x] 4.6 Wrap `server.createMessage(...)` in `Promise.race` with the `SAMPLING_TOOL_TIMEOUT_MS` timeout; any throw → `isError: true` with the timeout/unavailable message
  - [x] 4.7 Guard that `samplingResponse.content.type === "text"`; if not → `isError: true`
  - [x] 4.8 Call `applyEnrichment(newTask, samplingResponse.content.text)` — if `enrichmentResult.enriched === false` → `isError: true`
  - [x] 4.9 Only after enrichment succeeds: call `tasks.set(id, newTask)` then build and return the success response text

- [x] Task 5: Build and regression check (AC: #6, #7)
  - [x] 5.1 `npm run build` — zero TypeScript errors
  - [x] 5.2 `npm test` — all 12 existing tests pass

## Dev Notes

### Files to Change

| File | Action |
|------|--------|
| `src/index.ts` | The only file that changes in this story |

### Files to NOT Touch

| File | Reason |
|------|--------|
| `src/enrichment.ts` | Reuse as-is — do NOT modify |
| `src/enrichment.test.ts` | All 12 tests must pass unchanged |
| `proxy/src/index.ts` | Proxy routes all `sampling/createMessage` to Ollama — this is correct for 7.2; routing changes are in 7.3 |
| `proxy/src/sampling.ts` | Proxy sampling handler unchanged |
| `client/` | No client changes in this story |

### Exact Import Change

**Before (after Story 7.1):**
```typescript
import { VALID_PRIORITIES } from "./enrichment.js";
```

**After (Story 7.2):**
```typescript
import { applyEnrichment, VALID_PRIORITIES } from "./enrichment.js";
```

### New Constant

Add this immediately after the import block, before the `Task` interface:

```typescript
const SAMPLING_TOOL_TIMEOUT_MS = 15_000;
```

### Input Schema for `create_task_using_sampling`

```typescript
{
  name: "create_task_using_sampling",
  description:
    "Create a new task with AI-powered enrichment via MCP sampling. Requires the client to support the sampling capability. Intended for the 'You are the MCP client' manual learning flow.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title (required)" },
      description: { type: "string", description: "Optional starting description — the LLM will improve or create it" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Optional starting priority — the LLM may adjust it",
      },
      dueDate: {
        type: "string",
        description: "Optional due date (ISO 8601, e.g. 2026-04-01) — the LLM may suggest one",
      },
    },
    required: ["title"],
  },
}
```

**Key difference from `create_task`:** `description` is NOT required. The whole point is that the LLM provides/enriches it.

### Enrichment Prompt

Use this exact prompt string (mirrors the pattern from Story 6.1):

```typescript
const enrichmentPrompt =
  `You are enriching a task for a task manager. ` +
  `Given the task details below, suggest improvements to make it clearer and more actionable. ` +
  `Return ONLY a JSON object with zero or more of these fields: ` +
  `title (string), description (string), priority ("low" | "medium" | "high"), dueDate (ISO 8601 string). ` +
  `Return {} if no changes are warranted.\n\n` +
  `Task:\n` +
  `- title: ${original.title}\n` +
  `- description: ${original.description || "(none provided)"}\n` +
  `- priority: ${original.priority}` +
  (original.dueDate ? `\n- dueDate: ${original.dueDate}` : "");
```

### Full `case "create_task_using_sampling":` Handler

```typescript
case "create_task_using_sampling": {
  if (!(args.title as string)?.trim()) {
    return {
      content: [{ type: "text", text: "Title cannot be empty" }],
      isError: true,
    };
  }

  const id = String(tasks.size + 1);
  const newTask: Task = {
    id,
    title: args.title as string,
    description: (args.description as string) || "",
    status: "todo",
    priority: (args.priority as Task["priority"]) || "medium",
    createdAt: new Date().toISOString(),
    dueDate: args.dueDate ? (args.dueDate as string) : undefined,
  };

  const original = {
    title: newTask.title,
    description: newTask.description,
    priority: newTask.priority,
    dueDate: newTask.dueDate,
  };

  const enrichmentPrompt =
    `You are enriching a task for a task manager. ` +
    `Given the task details below, suggest improvements to make it clearer and more actionable. ` +
    `Return ONLY a JSON object with zero or more of these fields: ` +
    `title (string), description (string), priority ("low" | "medium" | "high"), dueDate (ISO 8601 string). ` +
    `Return {} if no changes are warranted.\n\n` +
    `Task:\n` +
    `- title: ${original.title}\n` +
    `- description: ${original.description || "(none provided)"}\n` +
    `- priority: ${original.priority}` +
    (original.dueDate ? `\n- dueDate: ${original.dueDate}` : "");

  let samplingResponse: Awaited<ReturnType<typeof server.createMessage>>;
  try {
    samplingResponse = await Promise.race([
      server.createMessage({
        messages: [{ role: "user", content: { type: "text", text: enrichmentPrompt } }],
        maxTokens: 300,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Sampling timed out")),
          SAMPLING_TOOL_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sampling failed";
    const isSamplingTimeout = msg === "Sampling timed out";
    return {
      content: [
        {
          type: "text",
          text: isSamplingTimeout
            ? "Sampling timed out — task not created"
            : `create_task_using_sampling requires sampling capability. The client reported: ${msg}`,
        },
      ],
      isError: true,
    };
  }

  if (samplingResponse.content.type !== "text") {
    return {
      content: [{ type: "text", text: "Sampling returned a non-text response — task not created" }],
      isError: true,
    };
  }

  const enrichmentResult = applyEnrichment(newTask, samplingResponse.content.text);

  if (!enrichmentResult.enriched) {
    return {
      content: [{ type: "text", text: "Sampling returned no usable enrichment — task not created" }],
      isError: true,
    };
  }

  tasks.set(id, newTask);

  const changes = enrichmentResult.changedFields
    .map((f) => {
      const origVal = original[f as keyof typeof original] ?? "";
      const newVal = (newTask as unknown as Record<string, string>)[f] ?? "";
      return `${f}: "${origVal}" → "${newVal}"`;
    })
    .join(", ");

  return {
    content: [
      {
        type: "text",
        text: `Created task ${id}: ${newTask.title} (enriched by AI — ${changes})`,
      },
    ],
  };
}
```

### `applyEnrichment` Behavior — What to Expect

From `src/enrichment.ts` (do NOT modify this file):

- **Mutates** the `task` object in place — changes are applied directly to `newTask`
- Returns `{ enriched: boolean, changedFields: string[] }`
- `enriched: true` only when at least one field was successfully updated
- `enriched: false` when: JSON parse fails, response is not an object, response is an array, or no fields changed (`{}`)
- Fields updated only when they pass validation: `title`/`description` must be non-empty strings; `priority` must be `"low"|"medium"|"high"`; `dueDate` must parse as a valid date
- **Do NOT call `applyEnrichment` before constructing `original`** — capture the snapshot first, then call `applyEnrichment`, then build the `changes` string from `original` vs `newTask`

### Response Text Format

The success response format from Story 6.1 was:
```
Created task {id}: {enriched-title} (enriched by AI — field: "original" → "enriched", ...)
```

For 7.2, use the **same format**. Example:
```
Created task 2: Fix authentication timeout bug (enriched by AI — title: "fix bug" → "Fix authentication timeout bug", description: "" → "Investigate and resolve...", priority: "medium" → "high")
```

The `client/src/lib/parseSamplingEnrichment.ts` that the React client uses to parse this format was added in Story 6.2. The format must match exactly so the parser continues to work for the `create_task_using_sampling` tool.

### How `server.createMessage()` Errors in Practice

When a client does NOT support sampling, the MCP SDK throws an error when `server.createMessage()` is called. The proxy currently handles ALL `sampling/createMessage` by forwarding to Ollama (from Story 6.1 via `proxy/src/sampling.ts`). The catch block in the handler covers:
- Client not supporting sampling (SDK throws)
- Ollama unreachable (proxy throws, relayed to server)
- Server-side timeout (the `Promise.race` timeout fires)

All three cases produce `isError: true` with a descriptive message.

### Proxy State for 7.2

The proxy (unchanged in 7.2) already:
- Injects `sampling: {}` into the `initialize` capabilities — do not add this to the server
- Routes all `sampling/createMessage` to Ollama via `handleSamplingRequest` in `proxy/src/sampling.ts`

This means `create_task_using_sampling` called via the proxy will always use Ollama for enrichment. The human-in-the-loop routing (Story 7.3) comes later and will differentiate based on which endpoint triggered the request.

### TypeScript Type for `server.createMessage` Return

The return type is inferred via `Awaited<ReturnType<typeof server.createMessage>>`. The relevant shape accessed is:
```typescript
samplingResponse.content.type  // "text" | "image" | ...
samplingResponse.content.text  // string (when type === "text")
```

### Where to Insert in the Switch Statement

Insert `case "create_task_using_sampling":` immediately **after** the `case "create_task":` block and **before** `case "update_task":`. The switch order should be:
1. `create_task`
2. `create_task_using_sampling` ← new
3. `update_task`
4. `update_task_status`
5. `get_task`
6. `delete_task`
7. `default`

### Git Commit Style

```
feat(7.2): add create_task_using_sampling tool with required sampling enrichment
```

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking

### Debug Log References

- TypeScript error on `samplingResponse.content.type`: the SDK's `CreateMessageResult.content` is typed as a union that includes both single content objects and arrays. Fixed by normalizing via `Array.isArray(samplingResponse.content) ? samplingResponse.content[0] : samplingResponse.content` before checking `.type`.

### Completion Notes List

- Added `applyEnrichment` to import from `./enrichment.js` (Task 3)
- Added `SAMPLING_TOOL_TIMEOUT_MS = 15_000` constant before `Task` interface (Task 2)
- Added `create_task_using_sampling` tool entry to `ListToolsRequestSchema` handler with exact description and input schema per story spec (Task 1)
- Added `case "create_task_using_sampling":` handler after `case "create_task":` with full flow: title validation → task construction → original snapshot → enrichment prompt → `Promise.race` with timeout → content normalization → `applyEnrichment` gate → conditional `tasks.set` → formatted success response (Task 4)
- `npm run build`: zero TypeScript errors (Task 5.1)
- `npm test`: all 12 enrichment unit tests pass (Task 5.2)
- All ACs satisfied: AC1 (enrichment flow), AC2 (no-sampling error), AC3 (timeout error), AC4 (empty enrichment error), AC5 (description), AC6 (create_task untouched), AC7 (build clean, tests pass)

### File List

- `src/index.ts` (modified)

### Change Log

- 2026-04-02: Implemented `create_task_using_sampling` tool — new tool in ListTools handler and new case in CallTool switch that uses `server.createMessage()` + `applyEnrichment` with a 15 s timeout, failing loudly on no-sampling, timeout, or empty enrichment. `create_task` and all other tools unchanged.
