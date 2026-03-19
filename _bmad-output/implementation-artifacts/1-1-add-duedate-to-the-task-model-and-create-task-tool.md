# Story 1.1: Add dueDate to the Task model and create_task tool

**Status:** done  
**Epic:** 1 – Task Management with Deadlines and Table Resources  
**Story ID:** 1.1  
**Story Key:** 1-1-add-duedate-to-the-task-model-and-create-task-tool  
**Date Created:** 2026-03-18  
**Output file:** `_bmad-output/implementation-artifacts/1-1-add-duedate-to-the-task-model-and-create-task-tool.md`

---

## User Story

As a developer or AI assistant using the MCP server,  
I want to create tasks with an optional due date,  
So that I can track deadlines alongside existing task fields.

---

## Acceptance Criteria (BDD)

**Given** the server is running and a client issues a `tools/call` for `create_task`  
**When** the call includes an optional `dueDate` argument (ISO 8601 date string, e.g. `"2026-04-01"`)  
**Then** the task is persisted with `dueDate` set to the provided value  
**And** the `Task` TypeScript interface includes `dueDate?: string`

---

**Given** a `create_task` call is made without `dueDate`  
**When** the tool executes  
**Then** the task is created with `dueDate` undefined and all other existing behaviour is unchanged

---

**Given** the existing `task://all` JSON resource is read  
**When** a task was created with `dueDate`  
**Then** the response includes `dueDate` in that task's JSON object

---

**Given** an existing client (Claude Desktop / Cursor) using `create_task` without `dueDate`  
**When** the upgraded server is running  
**Then** no error occurs and existing fields (title, description, status, priority) behave as before

---

## Scope (What This Story Covers)

**In scope:**
- Add `dueDate?: string` to the `Task` TypeScript interface
- Add optional `dueDate` property to `create_task` tool `inputSchema`
- Persist `dueDate` (when provided) on the created task object
- Verify `task://all` JSON resource includes `dueDate` in task JSON (automatic via `JSON.stringify`)

**Explicitly out of scope (separate stories):**
- `update_task` tool (Story 1.2)
- Markdown table resources (`task://table/*`, `task://open`) (Story 1.3)
- Prompts capability (Epic 2)
- Proxy or React app (Epics 3–4)

---

## Developer Context

### Existing Codebase Overview

The entire server lives in **one file**: `src/index.ts` (264 lines). This is the ONLY file you need to modify for this story. Do not create additional files.

**Current `Task` interface (lines 10–17 of `src/index.ts`):**
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
}
```

**Current `create_task` inputSchema (lines 118–131):**
```typescript
{
  name: "create_task",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      description: { type: "string", description: "Task description" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Task priority",
      },
    },
    required: ["title", "description"],
  },
}
```

**Current `create_task` handler (lines 178–197):**
```typescript
case "create_task": {
  const id = String(tasks.size + 1);
  const newTask: Task = {
    id,
    title: args.title as string,
    description: args.description as string,
    status: "todo",
    priority: (args.priority as Task["priority"]) || "medium",
    createdAt: new Date().toISOString(),
  };
  tasks.set(id, newTask);
  return {
    content: [
      {
        type: "text",
        text: `Created task ${id}: ${newTask.title}`,
      },
    ],
  };
}
```

**Current `task://all` resource (lines 69–79):** Already uses `JSON.stringify(Array.from(tasks.values()), null, 2)` — once `dueDate` is on the Task objects it will appear in the JSON output automatically. No change needed here beyond the model + create handler.

**Existing tools you must NOT break:** `update_task_status`, `get_task`, `delete_task` — all remain untouched. The existing `update_task_status` tool only updates status; it does NOT become `update_task` (that is Story 1.2's job).

---

## Technical Implementation Guide

### Step 1 — Extend the `Task` interface

Add `dueDate?: string` to the `Task` interface:

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;          // ← ADD THIS
}
```

**Place:** Same location, lines 10–17 of `src/index.ts`.

### Step 2 — Update `create_task` inputSchema

Add `dueDate` as an optional property in the tool definition:

```typescript
{
  name: "create_task",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      description: { type: "string", description: "Task description" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Task priority",
      },
      dueDate: {                                           // ← ADD THIS
        type: "string",
        description: "Optional due date (ISO 8601, e.g. 2026-04-01)",
      },
    },
    required: ["title", "description"],                   // dueDate stays optional
  },
}
```

### Step 3 — Persist `dueDate` in the `create_task` handler

Update the `newTask` object construction:

```typescript
case "create_task": {
  const id = String(tasks.size + 1);
  const newTask: Task = {
    id,
    title: args.title as string,
    description: args.description as string,
    status: "todo",
    priority: (args.priority as Task["priority"]) || "medium",
    createdAt: new Date().toISOString(),
    dueDate: args.dueDate ? (args.dueDate as string) : undefined,  // ← ADD THIS
  };
  tasks.set(id, newTask);
  return {
    content: [
      {
        type: "text",
        text: `Created task ${id}: ${newTask.title}`,
      },
    ],
  };
}
```

### Step 4 — Build and verify

```bash
npm run build
```

Should compile cleanly with zero TypeScript errors. The compiled output goes to `build/index.js`.

---

## Architecture & Pattern Compliance

These are hard rules from `architecture.md` that you MUST follow:

| Rule | Requirement |
|------|-------------|
| **File location** | All changes in `src/index.ts` only — do NOT create new files for this story |
| **Task field naming** | camelCase: `dueDate` (not `due_date`, `DueDate`, or any other variant) |
| **Date format** | ISO 8601 strings only (e.g. `"2026-04-01"` or `"2026-04-01T15:00:00Z"`) — no Date objects |
| **Optional field** | `dueDate` is optional (`dueDate?: string`) — do NOT make it required |
| **Backward compat (NFR2)** | All existing tools (`update_task_status`, `get_task`, `delete_task`) and resources (`task://all`, `task://summary`) must remain functionally identical |
| **No breaking changes** | `create_task` called without `dueDate` must still work identically |
| **STDIO only** | Server stays STDIO-only; no HTTP or new transports in this story |
| **In-memory store** | `tasks: Map<string, Task>` is the only persistence layer — no database, no file I/O |

---

## Specific Traps to Avoid

1. **Do NOT rename the existing `update_task_status` tool** — Story 1.2 adds `update_task` as a separate, more capable tool. The current `update_task_status` can remain as-is.
2. **Do NOT add `dueDate` validation** beyond basic TypeScript typing in this story. The PRD says "ISO 8601 string" but does not require server-side format validation in Story 1.1.
3. **Do NOT remove `dueDate: undefined` from the JSON output.** When `JSON.stringify` serializes an object with `dueDate: undefined`, JavaScript will omit the key entirely — this is correct behaviour.
4. **Do NOT touch the `task://summary` resource** — it doesn't reference individual task fields, so no change is needed.
5. **Do NOT initialize the sample task with a `dueDate`** — the sample task (id: "1") should remain unchanged so existing tests/integrations are unaffected.

---

## Verification Steps (Manual Testing)

After implementing, build and run the server, then verify via MCP tooling or Claude/Cursor:

1. **Create task with dueDate:**
   ```json
   { "name": "create_task", "arguments": { "title": "Test deadline", "description": "has a due date", "dueDate": "2026-04-15" } }
   ```
   → Should succeed; response text includes the new task ID.

2. **Create task without dueDate (backward compat):**
   ```json
   { "name": "create_task", "arguments": { "title": "No deadline", "description": "no due date" } }
   ```
   → Should succeed identically to pre-story behaviour.

3. **Read `task://all` resource:**
   → Task with dueDate should show `"dueDate": "2026-04-15"` in the JSON; task without dueDate should NOT have a `dueDate` key (undefined is omitted by JSON.stringify).

4. **Confirm existing tools still work:**
   - `update_task_status` with a known task ID and valid status
   - `get_task` with a known task ID
   - `delete_task` with a known task ID
   → All should work identically to before.

5. **Read `task://summary`:** → Same output format as before (no change expected).

---

## Project Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.7.x, ESM (`"type": "module"`) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` |
| Node types | `@types/node ^22.10.5` |
| Build command | `npm run build` (tsc → `build/`) |
| Run command | `node build/index.js` (STDIO) |
| Persistence | In-memory `Map<string, Task>` only |
| No test framework | Tests are manual for MVP |

---

## Definition of Done

- [x] `Task` interface has `dueDate?: string`
- [x] `create_task` inputSchema includes optional `dueDate` string property
- [x] `create_task` handler persists `dueDate` when provided
- [x] `task://all` resource JSON includes `dueDate` for tasks that have it
- [x] `create_task` without `dueDate` continues to work (no regression)
- [x] All existing tools (`update_task_status`, `get_task`, `delete_task`) still work
- [x] `task://summary` and `task://all` resources unchanged in behaviour
- [x] `npm run build` completes with zero TypeScript errors
- [x] No new files created (all changes in `src/index.ts`)

---

## Dev Agent Record

### Implementation Plan

Three minimal changes to `src/index.ts`:
1. Added `dueDate?: string` to `Task` interface
2. Added `dueDate` optional property to `create_task` inputSchema
3. Persisted `dueDate` in `create_task` handler via `args.dueDate ? (args.dueDate as string) : undefined`

`task://all` automatically includes `dueDate` via `JSON.stringify` (keys with `undefined` value are omitted — correct behaviour). No other files modified.

### Completion Notes

- All ACs satisfied. `npm run build` exits clean with zero TypeScript errors.
- Backward compatibility confirmed: `dueDate` is optional, existing sample task and existing tool handlers (`update_task_status`, `get_task`, `delete_task`) are untouched.
- No new files created.

### File List

- `src/index.ts` (modified)

### Change Log

- 2026-03-18: Added `dueDate?: string` to Task interface, `create_task` inputSchema, and `create_task` handler (Story 1.1)
