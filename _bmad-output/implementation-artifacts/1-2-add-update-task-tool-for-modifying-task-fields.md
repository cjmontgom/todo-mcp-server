# Story 1.2: Add update_task tool for modifying task fields

**Status:** review  
**Epic:** 1 – Task Management with Deadlines and Table Resources  
**Story ID:** 1.2  
**Story Key:** 1-2-add-update-task-tool-for-modifying-task-fields  
**Date Created:** 2026-03-19  
**Output file:** `_bmad-output/implementation-artifacts/1-2-add-update-task-tool-for-modifying-task-fields.md`

---

## User Story

As a developer or AI assistant using the MCP server,  
I want to update a task's fields (title, description, status, priority, dueDate) after creation,  
So that I can correct deadlines, reprioritise, and change task status without deleting and recreating.

---

## Acceptance Criteria (BDD)

**AC1:** Given the server is running and a task exists with a known ID  
**When** a client calls `update_task` with that ID and one or more of `{title, description, status, priority, dueDate}`  
**Then** only the supplied fields are updated; unspecified fields remain unchanged

---

**AC2:** Given a task with `dueDate` set  
**When** `update_task` is called with a new `dueDate` value  
**Then** the task's `dueDate` is updated and the change is visible in subsequent resource reads (e.g. `task://all`)

---

**AC3:** Given `update_task` is called with `dueDate` set to `null`  
**When** `dueDate` was previously set  
**Then** the field is cleared (set to `undefined`)

**And** given `update_task` is called *without* a `dueDate` key at all  
**When** `dueDate` was previously set  
**Then** the field remains unchanged (omission ≠ clearing)

---

**AC4:** Given `update_task` is called with an unknown task ID  
**When** the tool executes  
**Then** the server returns a clear MCP error response (`isError: true`, descriptive message)

---

**AC5:** Given `update_task` is called with an invalid `status` value (e.g. `"cancelled"`) or an invalid `priority` value (e.g. `"urgent"`)  
**When** the tool executes  
**Then** the server returns a validation error (`isError: true`) and the task is not modified

---

## Scope

**In scope:**
- Register a NEW `update_task` tool in `ListToolsRequestSchema` handler with `inputSchema`
- Implement `update_task` case in `CallToolRequestSchema` handler
- Partial update semantics: only supplied fields are changed
- `dueDate` clearing: explicit `null` clears it; omission leaves it unchanged
- Validation: reject unknown task IDs and invalid `status` / `priority` enum values
- Keep `update_task_status` tool untouched for backward compatibility (NFR2)

**Explicitly out of scope:**
- Markdown table resources (`task://table/*`, `task://open`) — Story 1.3
- Removing or renaming the existing `update_task_status` tool
- Prompts capability — Epic 2
- Proxy or React app — Epics 3–4

---

## Tasks / Subtasks

- [x] Task 1: Add `update_task` tool definition to `ListToolsRequestSchema` handler (AC: #1, #3)
  - [x] 1.1 Add tool entry with `inputSchema` — `id` required, all other fields optional
  - [x] 1.2 Include `dueDate` as `type: ["string", "null"]` to accept both string values and explicit `null`
  - [x] 1.3 Include `status` with enum `["todo", "in-progress", "done"]` (optional)
  - [x] 1.4 Include `priority` with enum `["low", "medium", "high"]` (optional)
- [x] Task 2: Implement `update_task` handler case in `CallToolRequestSchema` handler (AC: #1–#5)
  - [x] 2.1 Look up task by `id`; return `isError: true` if not found (AC: #4)
  - [x] 2.2 Validate `status` and `priority` enum values if provided; return `isError: true` on invalid values (AC: #5)
  - [x] 2.3 Apply partial update: for each field (`title`, `description`, `status`, `priority`), update only if the key is present in `args` and not `undefined`
  - [x] 2.4 Handle `dueDate` clearing: if `args.dueDate === null` → set `task.dueDate = undefined`; if `args.dueDate` is a string → update; if key absent → no change (AC: #3)
  - [x] 2.5 Return success response with confirmation message including task ID
- [x] Task 3: Build and verify (AC: all)
  - [x] 3.1 Run `npm run build` — zero TypeScript errors
  - [x] 3.2 Verify existing tools still work (`create_task`, `update_task_status`, `get_task`, `delete_task`)

---

## Dev Notes

### Existing Codebase (post Story 1.1)

The entire server is **one file**: `src/index.ts` (~270 lines). This is the ONLY file to modify.

**Current `Task` interface (lines 10–18):**
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;
}
```

**Existing tools registered (lines 115–176):** `create_task`, `update_task_status`, `get_task`, `delete_task`

**Existing error response pattern (e.g. line 207–210):**
```typescript
if (!task) {
  return {
    content: [{ type: "text", text: `Task ${args.id} not found` }],
    isError: true,
  };
}
```

### Critical Design Decisions

**1. `update_task` vs `update_task_status`:**  
`update_task_status` already exists and only changes `status`. The new `update_task` tool is more capable — it can update ANY field. Both tools MUST coexist for backward compatibility (NFR2). Do NOT remove, rename, or modify `update_task_status`.

**2. Partial update semantics (the key challenge):**  
MCP tool arguments arrive as a plain object. The handler must distinguish between:
- **Key absent** (field not provided) → leave unchanged
- **Key present with a value** → update to that value
- **Key present with `null`** (only for `dueDate`) → clear the field

Use the `in` operator to check if a key was provided: `if ("title" in args)`. Do NOT rely on truthiness checks — that would prevent setting an empty string title.

**3. `dueDate` null handling in JSON Schema:**  
To allow explicit `null` in the `inputSchema`, declare `dueDate` as `type: ["string", "null"]`. This tells MCP clients that `null` is a valid value for clearing the field.

**4. Validation before mutation:**  
Validate ALL provided fields BEFORE mutating the task. If validation fails, return `isError: true` and do NOT partially apply changes.

### Where to Place Code

**Tool definition:** Add the new tool entry to the `tools` array in the `ListToolsRequestSchema` handler (after the existing `create_task` entry, around line 136). Keep related tools grouped together.

**Tool handler:** Add a new `case "update_task":` in the `switch` block within `CallToolRequestSchema` handler (after the `create_task` case, around line 203).

### Anti-Patterns to Avoid

1. **Do NOT remove `update_task_status`** — it must remain for backward compatibility.
2. **Do NOT use `args.title || task.title`** for updates — this fails if the user intentionally sets title to an empty string. Use `"title" in args` instead.
3. **Do NOT mutate the task before validation completes** — validate all provided enum values first, then apply.
4. **Do NOT add `dueDate` format validation** (e.g. regex for ISO 8601) — the PRD does not require server-side format validation for dates; keep it consistent with Story 1.1's approach.
5. **Do NOT create new files** — all changes go in `src/index.ts`.
6. **Do NOT change the `createdAt` field** — it is set once at creation and never updated.
7. **Do NOT change the task `id`** — IDs are immutable.

---

## Technical Implementation Guide

### Step 1 — Add `update_task` to tool definitions

Add this entry to the `tools` array in the `ListToolsRequestSchema` handler, after `create_task`:

```typescript
{
  name: "update_task",
  description: "Update one or more fields of an existing task",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Task ID to update" },
      title: { type: "string", description: "New task title" },
      description: { type: "string", description: "New task description" },
      status: {
        type: "string",
        enum: ["todo", "in-progress", "done"],
        description: "New task status",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "New task priority",
      },
      dueDate: {
        type: ["string", "null"],
        description: "New due date (ISO 8601) or null to clear",
      },
    },
    required: ["id"],
  },
},
```

### Step 2 — Implement `update_task` handler

Add this case to the `switch` block in the `CallToolRequestSchema` handler, after the `create_task` case:

```typescript
case "update_task": {
  const task = tasks.get(args.id as string);
  if (!task) {
    return {
      content: [{ type: "text", text: `Task ${args.id} not found` }],
      isError: true,
    };
  }

  // Validate enum fields before mutating
  const validStatuses = ["todo", "in-progress", "done"];
  const validPriorities = ["low", "medium", "high"];

  if ("status" in args && !validStatuses.includes(args.status as string)) {
    return {
      content: [{ type: "text", text: `Invalid status: ${args.status}. Must be one of: ${validStatuses.join(", ")}` }],
      isError: true,
    };
  }

  if ("priority" in args && !validPriorities.includes(args.priority as string)) {
    return {
      content: [{ type: "text", text: `Invalid priority: ${args.priority}. Must be one of: ${validPriorities.join(", ")}` }],
      isError: true,
    };
  }

  // Apply partial updates — only fields present in args
  if ("title" in args) task.title = args.title as string;
  if ("description" in args) task.description = args.description as string;
  if ("status" in args) task.status = args.status as Task["status"];
  if ("priority" in args) task.priority = args.priority as Task["priority"];

  // dueDate: null clears, string updates, absent leaves unchanged
  if ("dueDate" in args) {
    task.dueDate = args.dueDate === null ? undefined : (args.dueDate as string);
  }

  return {
    content: [
      {
        type: "text",
        text: `Updated task ${args.id}: ${task.title}`,
      },
    ],
  };
}
```

### Step 3 — Build and verify

```bash
npm run build
```

Should compile cleanly with zero TypeScript errors.

---

## Architecture & Pattern Compliance

| Rule | Requirement |
|------|-------------|
| **File location** | All changes in `src/index.ts` only — do NOT create new files |
| **Task field naming** | camelCase: `dueDate`, `createdAt` (not `due_date`) |
| **Date format** | ISO 8601 strings only — no Date objects |
| **Backward compat (NFR2)** | `update_task_status`, `create_task`, `get_task`, `delete_task` remain unchanged |
| **MCP error pattern** | Use `isError: true` in response content (not JSON-RPC errors) for tool execution errors |
| **STDIO only** | No HTTP or new transports |
| **In-memory store** | `tasks: Map<string, Task>` — no database, no file I/O |
| **Tool naming** | Exact name `update_task` per PRD FR3 |

---

## Previous Story Intelligence (Story 1.1)

**What was done:**
- Added `dueDate?: string` to `Task` interface
- Added `dueDate` to `create_task` inputSchema and handler
- Pattern for optional field: `args.dueDate ? (args.dueDate as string) : undefined`

**Patterns to follow:**
- Error responses use `{ content: [{ type: "text", text: "..." }], isError: true }`
- Tool definitions placed in `tools` array within `ListToolsRequestSchema`
- Tool handlers as `case` blocks within the `switch (name)` in `CallToolRequestSchema`
- All changes in single file `src/index.ts`
- `npm run build` for verification

**What to NOT repeat:**
- Story 1.1 used simple truthiness check for `dueDate` (`args.dueDate ? ...`). For `update_task`, use `"key" in args` pattern instead, because:
  - Truthiness fails for empty strings (a valid title)
  - We need to distinguish "not provided" from "set to null" for `dueDate`

---

## Git Intelligence

**Recent commits (newest first):**
1. `952a41b` — feat: add optional dueDate to Task model and create_task tool (Story 1.1)
2. `d3a626f` — feat: install BMAD and create epics
3. `7b6f9bc` — feat: build basic server

**Patterns:** Conventional commit messages with `feat:` prefix and story reference. Single-file changes to `src/index.ts` for server stories.

---

## Project Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.7.x, ESM (`"type": "module"`) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` (latest compatible: 1.27.1) |
| Node types | `@types/node ^22.10.5` |
| Build command | `npm run build` (tsc → `build/`) |
| Run command | `node build/index.js` (STDIO) |
| Persistence | In-memory `Map<string, Task>` only |
| No test framework | Tests are manual for MVP |

---

## Verification Steps (Manual Testing)

After implementing, build and verify:

1. **Update single field (title):**
   ```json
   { "name": "update_task", "arguments": { "id": "1", "title": "Renamed Task" } }
   ```
   → Task 1 title changes; all other fields unchanged.

2. **Update multiple fields:**
   ```json
   { "name": "update_task", "arguments": { "id": "1", "status": "in-progress", "priority": "high", "dueDate": "2026-05-01" } }
   ```
   → Status, priority, and dueDate all updated; title and description unchanged.

3. **Clear dueDate with null:**
   ```json
   { "name": "update_task", "arguments": { "id": "1", "dueDate": null } }
   ```
   → `dueDate` removed from task; read `task://all` to confirm `dueDate` key is absent.

4. **Unknown task ID:**
   ```json
   { "name": "update_task", "arguments": { "id": "999" } }
   ```
   → Returns error: `isError: true`, message: "Task 999 not found".

5. **Invalid status value:**
   ```json
   { "name": "update_task", "arguments": { "id": "1", "status": "cancelled" } }
   ```
   → Returns validation error: `isError: true`; task is NOT modified.

6. **Existing tools still work:**
   - `create_task` with and without `dueDate`
   - `update_task_status` with valid status
   - `get_task` with known ID
   - `delete_task` with known ID
   → All behave identically to before.

---

## Definition of Done

- [x] `update_task` tool registered in `ListToolsRequestSchema` with correct `inputSchema`
- [x] `update_task` handler implements partial updates (only supplied fields change)
- [x] `dueDate` can be cleared with explicit `null`; omission leaves it unchanged
- [x] Unknown task ID returns `isError: true` with descriptive message
- [x] Invalid `status` or `priority` values return `isError: true`; task unmodified
- [x] Existing `update_task_status` tool remains and works unchanged
- [x] All existing tools (`create_task`, `get_task`, `delete_task`) still work
- [x] `task://all` and `task://summary` resources unchanged in behaviour
- [x] `npm run build` completes with zero TypeScript errors
- [x] No new files created (all changes in `src/index.ts`)

---

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus (via Cursor)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Added `update_task` tool definition to `ListToolsRequestSchema` handler (lines 138–163) with `id` required, all other fields optional, `dueDate` typed as `["string", "null"]`
- Added `update_task` case handler in `CallToolRequestSchema` switch block (lines 232–275) with: task lookup, enum validation before mutation, partial update via `"key" in args` pattern, `dueDate` null-clearing semantics
- All existing tools (`create_task`, `update_task_status`, `get_task`, `delete_task`) and resources (`task://all`, `task://summary`) remain unchanged
- `npm run build` passes with zero TypeScript errors, zero lint issues
- No new files created — all changes in `src/index.ts`

### Change Log

- 2026-03-19: Implemented Story 1.2 — added `update_task` tool with partial update semantics, enum validation, and dueDate null-clearing

### File List

- `src/index.ts` (modified) — added update_task tool definition and handler
