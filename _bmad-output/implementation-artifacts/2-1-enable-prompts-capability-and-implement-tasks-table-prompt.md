# Story 2.1: Enable prompts capability and implement tasks_table prompt

Status: review

## Story

As a developer or AI assistant using the MCP server,
I want to list prompts and invoke a tasks_table prompt with a sort argument,
so that I can retrieve a formatted task table in one prompt invocation rather than reading a resource and sorting manually.

## Acceptance Criteria

1. **AC1 — `prompts: {}` declared in server capabilities**
   Given the server starts up
   When a client sends `initialize`
   Then the server's capabilities include `prompts: {}`

2. **AC2 — `prompts/list` returns `tasks_table` entry with `sort` argument**
   Given the prompts capability is enabled
   When a client calls `prompts/list`
   Then the response includes a prompt entry with `name: "tasks_table"`, a description, and one argument definition for `sort` with `name: "sort"`, `description`, and `required: true`

3. **AC3 — `sort: "deadline"` returns same table as `task://table/by-deadline`**
   Given a client calls `prompts/get` with `name: "tasks_table"` and `arguments: { sort: "deadline" }`
   When the server handles the request
   Then the response contains `messages` with one `{ role: "user", content: { type: "text", text: <markdown table> } }` whose `text` is identical to the markdown produced by the `task://table/by-deadline` read handler (ascending dueDate, nulls last)

4. **AC4 — `sort: "priority"` returns same table as `task://table/by-priority`**
   Given `sort` is `"priority"`
   When `prompts/get` is called for `tasks_table`
   Then the returned table matches `task://table/by-priority` (high → medium → low)

5. **AC5 — `sort: "priority-then-deadline"` returns same table as `task://table/priority-then-deadline`**
   Given `sort` is `"priority-then-deadline"`
   When `prompts/get` is called for `tasks_table`
   Then the returned table matches `task://table/priority-then-deadline` (priority first, then dueDate within groups)

6. **AC6 — Invalid `sort` returns a descriptive error**
   Given an invalid `sort` value is provided (e.g. `"unknown"`)
   When `prompts/get` is called
   Then the server returns a descriptive error response

## Scope

**In scope:**
- Add `prompts: {}` to capabilities in the `new Server(...)` constructor
- Import `ListPromptsRequestSchema` and `GetPromptRequestSchema` from `@modelcontextprotocol/sdk/types.js`
- Register `ListPromptsRequestSchema` handler returning one prompt: `tasks_table`
- Register `GetPromptRequestSchema` handler implementing `tasks_table` with `sort` argument
- Reuse the existing `markdownTable()` helper and the existing sort logic already in the `ReadResourceRequestSchema` handler

**Out of scope:**
- Story 2.2 prompts (`tasks_summary_for_stakeholders`, `completions_by_date`) — next story
- Proxy, React app, or any client changes
- Any modification to existing tools or resources

## Tasks / Subtasks

- [x] Task 1: Update server capabilities to include `prompts: {}` (AC: #1)
  - [x] 1.1 In the `new Server(...)` constructor (around line 52), add `prompts: {}` alongside `resources: {}` and `tools: {}`
- [x] Task 2: Import prompt schemas from MCP SDK (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Add `ListPromptsRequestSchema` and `GetPromptRequestSchema` to the existing import from `@modelcontextprotocol/sdk/types.js`
- [x] Task 3: Register `ListPromptsRequestSchema` handler (AC: #2)
  - [x] 3.1 Call `server.setRequestHandler(ListPromptsRequestSchema, async () => { ... })` returning a `prompts` array with one entry for `tasks_table`
  - [x] 3.2 Include `name`, `description`, and `arguments` array with `{ name: "sort", description: "Sort order: 'deadline' | 'priority' | 'priority-then-deadline'", required: true }`
- [x] Task 4: Register `GetPromptRequestSchema` handler (AC: #3, #4, #5, #6)
  - [x] 4.1 Call `server.setRequestHandler(GetPromptRequestSchema, async (request) => { ... })`
  - [x] 4.2 Extract `name` and `arguments` from `request.params`
  - [x] 4.3 For unknown prompt `name`, throw `new Error("Prompt not found: ...")`
  - [x] 4.4 For `tasks_table`, extract `sort` from `arguments` object
  - [x] 4.5 Apply the correct sort using the same logic already in the resource read handler (inline or helper); call `markdownTable(sorted)`
  - [x] 4.6 For invalid `sort` value, throw `new Error("Invalid sort value: ...")`
  - [x] 4.7 Return `{ messages: [{ role: "user", content: { type: "text", text: tableText } }] }`
- [x] Task 5: Build and verify (AC: all)
  - [x] 5.1 Run `npm run build` — zero TypeScript errors
  - [x] 5.2 Manually verify `prompts/list` response includes `tasks_table`
  - [x] 5.3 Manually verify each `sort` value returns the correct table

## Dev Notes

### File to Modify

**`src/index.ts` is the ONLY file to modify.** Do NOT create new files. This is the established single-file pattern from Stories 1.1–1.3.

### Current File State (post Story 1.3, ~477 lines)

All relevant anchors in `src/index.ts`:

| Lines | Content |
|-------|---------|
| 1–8 | Imports from `@modelcontextprotocol/sdk` |
| 10–18 | `Task` interface |
| 20–22 | `VALID_STATUSES`, `VALID_PRIORITIES`, `PRIORITY_RANK` constants |
| 24–36 | `escMdCell` + `markdownTable` helper functions |
| 38–49 | In-memory `tasks` Map + sample task |
| 51–63 | `new Server(...)` with `capabilities: { resources: {}, tools: {} }` |
| 65–113 | `ListResourcesRequestSchema` handler |
| 115–209 | `ReadResourceRequestSchema` handler (contains sort logic to replicate) |
| 211–303 | `ListToolsRequestSchema` handler |
| 305–465 | `CallToolRequestSchema` handler |
| 467–477 | `main()` and startup |

### Step 1 — Update Capabilities (line 58–61)

Change:
```typescript
capabilities: {
  resources: {},
  tools: {},
},
```
To:
```typescript
capabilities: {
  resources: {},
  tools: {},
  prompts: {},
},
```

### Step 2 — Add Imports (lines 3–8)

Add `ListPromptsRequestSchema` and `GetPromptRequestSchema` to the existing import:
```typescript
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
```

### Step 3 — ListPromptsRequestSchema Handler

Insert after `CallToolRequestSchema` handler block (after line 465) and before `main()`:

```typescript
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "tasks_table",
        description: "Get all tasks as a markdown table, sorted by the specified order",
        arguments: [
          {
            name: "sort",
            description: "Sort order: 'deadline' | 'priority' | 'priority-then-deadline'",
            required: true,
          },
        ],
      },
    ],
  };
});
```

### Step 4 — GetPromptRequestSchema Handler

Insert immediately after the `ListPromptsRequestSchema` handler:

```typescript
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: promptArgs = {} } = request.params;

  if (name !== "tasks_table") {
    throw new Error(`Prompt not found: ${name}`);
  }

  const sort = promptArgs["sort"];
  const allTasks = Array.from(tasks.values());
  let sorted: Task[];

  if (sort === "deadline") {
    sorted = [...allTasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sort === "priority") {
    sorted = [...allTasks].sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    );
  } else if (sort === "priority-then-deadline") {
    sorted = [...allTasks].sort((a, b) => {
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    throw new Error(
      `Invalid sort value: "${sort}". Must be one of: deadline, priority, priority-then-deadline`
    );
  }

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: markdownTable(sorted),
        },
      },
    ],
  };
});
```

### Critical Implementation Details

**Return shape for `GetPromptRequestSchema`:** The response must match `GetPromptResultSchema`:
```typescript
{
  messages: Array<{
    role: "user" | "assistant";
    content: { type: "text"; text: string };
  }>
}
```
The acceptance criteria explicitly state "one user-role `PromptMessage`" — return exactly one message with `role: "user"`.

**`promptArgs` typing:** `request.params.arguments` is typed as `Record<string, string> | undefined` in the SDK. The `sort` value extracted from it is a `string`. No parsing required.

**Sort logic MUST match resource handlers exactly:** The sort logic for `"deadline"`, `"priority"`, and `"priority-then-deadline"` in this handler must produce identical output to the corresponding `ReadResourceRequestSchema` handlers. Duplicate the sort logic inline — it is 3–5 lines per case and already works correctly. Do NOT refactor to a shared helper (out of scope; no new files).

**Throw vs isError:** Prompt handlers use `throw new Error(...)` for errors (same as resource handlers), NOT the `{ content: [...], isError: true }` pattern used by tool handlers.

**`markdownTable` and `PRIORITY_RANK` are already defined** — do NOT redefine them.

### Project Structure Compliance

| Rule | Requirement |
|------|-------------|
| **File** | `src/index.ts` only — no new files |
| **STDIO transport** | Unchanged — do not touch `main()` |
| **Backward compat (NFR2)** | All existing resources and tools untouched |
| **In-memory store** | No persistence changes |
| **Naming** | Tool/resource names match PRD exactly: `tasks_table` with underscore |

### Anti-Patterns to Avoid

1. **Do NOT use the tool error pattern** (`{ content: [{ type: "text", text: "..." }], isError: true }`) in prompt handlers — use `throw new Error(...)` instead
2. **Do NOT modify any existing handlers** — resources, tools, or the existing server constructor logic beyond adding `prompts: {}`
3. **Do NOT create a new helper function** for sorting — duplicate the existing sort logic inline in the `GetPromptRequestSchema` handler
4. **Do NOT create new files** — all changes in `src/index.ts`
5. **Do NOT omit `prompts: {}`** from the capabilities object — without it, clients will not advertise prompts support during `initialize`, failing AC1
6. **Do NOT return more than one message** in the prompt response — AC3–AC5 each require exactly one user-role `PromptMessage`
7. **Do NOT accept `sort` as an optional argument** — it is `required: true` and the handler should throw for missing/invalid values

## Previous Story Intelligence

**From Story 1.3 (most recent):**
- Single-file pattern (`src/index.ts`) is confirmed and stable — do NOT create new files
- `markdownTable()` and `PRIORITY_RANK` are defined at the top of the file — reuse them directly
- All three sort algorithms (by-deadline, by-priority, priority-then-deadline) are already implemented and verified working in the `ReadResourceRequestSchema` handler — copy them exactly
- `npm run build` (tsc → `build/`) is the verification command
- Error responses in resource/prompt handlers use `throw new Error(...)` — NOT the tool pattern
- All tool handlers remain at lines 305–465; insert new handlers after them before `main()`

**From Story 1.1–1.2:**
- `VALID_STATUSES` and `VALID_PRIORITIES` constants at top — do not redefine
- Pattern for optional fields: `"key" in args` for tools; `request.params.arguments` for prompts

## Architecture & Pattern Compliance

| Area | Decision |
|------|----------|
| **Capabilities** | Add `prompts: {}` alongside `resources: {}` and `tools: {}` |
| **Import source** | `@modelcontextprotocol/sdk/types.js` (same import already used) |
| **Handler placement** | After `CallToolRequestSchema` handler, before `main()` |
| **Prompt name** | `tasks_table` (underscore, lowercase — match PRD exactly) |
| **Sort values** | `"deadline"`, `"priority"`, `"priority-then-deadline"` (match resource URI suffixes) |
| **Table content** | Must be byte-for-byte identical to the corresponding resource read (same sort, same `markdownTable()` call) |
| **Error mechanism** | `throw new Error(...)` (not tool `isError` pattern) |

## Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.7.x, ESM (`"type": "module"`) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` (installed: compatible with prompt schemas) |
| New imports | `ListPromptsRequestSchema`, `GetPromptRequestSchema` from `@modelcontextprotocol/sdk/types.js` |
| Build command | `npm run build` (tsc → `build/`) |
| Run command | `node build/index.js` (STDIO) |
| Persistence | In-memory `Map<string, Task>` — unchanged |

## Git Intelligence

**Recent commits (newest first):**
1. `92f0f73` — feat: add Epic 5 (LLM natural language MCP interaction) and update planning artifacts
2. `788c7a0` — feat: add update_task tool for modifying task fields (Story 1.2)
3. `952a41b` — feat: add optional dueDate to Task model and create_task tool (Story 1.1)
4. `d3a626f` — feat: install BMAD and create epics

**Convention:** `feat:` prefix; story reference in parentheses.

**Suggested commit message:** `feat: add prompts capability and tasks_table prompt (Story 2.1)`

## Verification Steps (Manual Testing)

After `npm run build && node build/index.js`:

1. **`initialize` — capabilities include `prompts`:**
   Send `initialize` → verify response capabilities object contains `prompts: {}`

2. **`prompts/list` — returns `tasks_table`:**
   Call `prompts/list` → verify response includes `{ name: "tasks_table", arguments: [{ name: "sort", required: true }] }`

3. **`tasks_table` with `sort: "deadline"`:**
   Call `prompts/get` with `{ name: "tasks_table", arguments: { sort: "deadline" } }` → verify `messages[0].role === "user"`, `messages[0].content.type === "text"`, and the table rows are sorted by dueDate ascending (nulls last)

4. **`tasks_table` with `sort: "priority"`:**
   Same as above but `sort: "priority"` → verify rows ordered high → medium → low

5. **`tasks_table` with `sort: "priority-then-deadline"`:**
   Same as above but `sort: "priority-then-deadline"` → verify compound sort

6. **Invalid `sort` value:**
   Call with `sort: "bogus"` → verify error response (non-zero code or thrown error)

7. **Backward compatibility:**
   Read `task://table/by-deadline`, `task://table/by-priority`, `task://table/priority-then-deadline` → verify unchanged.
   Call `create_task`, `update_task` → verify unchanged.

8. **Build:** `npm run build` → zero TypeScript errors.

## Definition of Done

- [x] `prompts: {}` added to `new Server(...)` capabilities
- [x] `ListPromptsRequestSchema` and `GetPromptRequestSchema` imported from SDK
- [x] `ListPromptsRequestSchema` handler registered, returning `tasks_table` with `sort` argument
- [x] `GetPromptRequestSchema` handler registered, implementing all three sort values
- [x] Invalid `sort` value throws descriptive error
- [x] Unknown prompt name throws descriptive error
- [x] Prompt response shape: `{ messages: [{ role: "user", content: { type: "text", text: string } }] }`
- [x] Table content matches corresponding resource read handler output exactly
- [x] All existing resources and tools unchanged
- [x] `npm run build` completes with zero TypeScript errors
- [x] No new files created (all changes in `src/index.ts`)

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (2026-03-20)

### Debug Log References

### Completion Notes List

- Added `prompts: {}` to server capabilities object (line ~58).
- Imported `ListPromptsRequestSchema` and `GetPromptRequestSchema` from `@modelcontextprotocol/sdk/types.js`.
- Registered `ListPromptsRequestSchema` handler returning `tasks_table` prompt with required `sort` argument.
- Registered `GetPromptRequestSchema` handler supporting `"deadline"`, `"priority"`, and `"priority-then-deadline"` sort values; throws descriptive errors for unknown prompt name or invalid sort value.
- Sort logic duplicated inline from existing `ReadResourceRequestSchema` handlers — byte-for-byte identical output.
- `npm run build` completed with zero TypeScript errors.
- All existing resources and tools verified untouched.

### File List

- src/index.ts

## Change Log

- 2026-03-20: Implemented prompts capability and `tasks_table` prompt — added `prompts: {}` to capabilities, imported prompt schemas, registered `ListPromptsRequestSchema` and `GetPromptRequestSchema` handlers in `src/index.ts`. Build passes with zero errors.
