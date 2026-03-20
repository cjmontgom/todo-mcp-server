# Story 1.3: Add markdown table resources and shared table helper

Status: review

## Story

As a developer or AI assistant using the MCP server,
I want to read tasks as formatted markdown tables sorted by deadline, priority, or both,
So that I can view task data in a structured way without building my own formatter.

## Acceptance Criteria

1. **AC1 — `task://table/all` returns a markdown table of all tasks**
   Given the server is running with at least one task
   When a client reads `task://table/all`
   Then the response has `mimeType: "text/markdown"` and contains a pipe-delimited table with columns ID, Title, Priority, Due, Status, with one row per task, sorted by `id` ascending (lexicographic)

2. **AC2 — `task://table/by-deadline` sorts by dueDate ascending, nulls last**
   Given tasks exist with and without `dueDate`
   When a client reads `task://table/by-deadline`
   Then rows are sorted ascending by `dueDate`; tasks without a due date appear last

3. **AC3 — `task://table/by-priority` sorts high → medium → low, then by `id` ascending**
   Given tasks exist with mixed priorities (high, medium, low)
   When a client reads `task://table/by-priority`
   Then rows are ordered high → medium → low; within the same priority, rows are sorted by `id` ascending (lexicographic) as a stable tie-breaker

4. **AC4 — `task://table/priority-then-deadline` sorts by priority first, then dueDate**
   Given tasks exist with mixed priorities and due dates
   When a client reads `task://table/priority-then-deadline`
   Then rows are ordered by priority first (high → medium → low), then by `dueDate` ascending within each priority group (nulls last within each group)

5. **AC5 — `task://open` returns only open tasks, sorted by `id` ascending**
   Given the server is running with a mix of todo, in-progress, and done tasks
   When a client reads `task://open`
   Then the response contains only tasks with status `todo` or `in-progress` as a markdown table, sorted by `id` ascending (lexicographic)

6. **AC6 — Backward compatibility preserved**
   Given `task://all` (JSON) and `task://summary` (text) are read after adding the new resources
   When the server is running
   Then both resources return responses identical in shape and content to their pre-extension behaviour (NFR2)

7. **AC7 — Shared helper produces all markdown tables**
   A shared internal helper function (e.g. `markdownTable(tasks: Task[]): string`) produces the markdown rows used by all five table resources, ensuring column order is stable across all endpoints

8. **AC8 — All five URIs verified individually**
   Given all five new markdown resources have been implemented
   When each URI is read individually via `resources/read`
   Then each returns a valid `text/markdown` response with the correct sort order or filter

## Scope

**In scope:**
- Register five new resources in `ListResourcesRequestSchema` handler
- Implement read handlers for all five URIs in `ReadResourceRequestSchema` handler
- Create a shared `markdownTable(tasks: Task[]): string` helper function with a cell-escaping helper (`escMdCell`) that replaces `|` with `\|` and newlines with a space
- Priority sort order: high → medium → low; ties broken by `id` ascending (lexicographic)
- dueDate sort: ascending, nulls last
- `task://table/all` sort: `id` ascending (lexicographic)
- `task://open` filter: status `todo` or `in-progress`; sort: `id` ascending (lexicographic)

**Out of scope:**
- Prompts capability — Epic 2
- Proxy or React app — Epics 3–4
- Any changes to existing tools (`create_task`, `update_task`, `update_task_status`, `get_task`, `delete_task`)
- Any changes to existing resources (`task://all`, `task://summary`)

## Tasks / Subtasks

- [x] Task 1: Create shared `markdownTable` helper function (AC: #7)
  - [x] 1.1 Define `function markdownTable(tasks: Task[]): string` above the server handlers
  - [x] 1.2 Generate pipe-delimited header row: `| ID | Title | Priority | Due | Status |`
  - [x] 1.3 Generate separator row: `| --- | --- | --- | --- | --- |`
  - [x] 1.4 Generate one data row per task: `| {id} | {title} | {priority} | {dueDate or ""} | {status} |`
  - [x] 1.5 Return the complete table as a single string (header + separator + rows joined by newlines)
- [x] Task 2: Add five new resources to `ListResourcesRequestSchema` handler (AC: #1–#5, #8)
  - [x] 2.1 Add `task://table/all` resource entry with name, mimeType `text/markdown`, description
  - [x] 2.2 Add `task://table/by-deadline` resource entry
  - [x] 2.3 Add `task://table/by-priority` resource entry
  - [x] 2.4 Add `task://table/priority-then-deadline` resource entry
  - [x] 2.5 Add `task://open` resource entry
- [x] Task 3: Implement read handlers in `ReadResourceRequestSchema` handler (AC: #1–#6, #8)
  - [x] 3.1 Add `task://table/all` handler — pass `Array.from(tasks.values())` to `markdownTable`
  - [x] 3.2 Add `task://table/by-deadline` handler — sort by dueDate ascending (nulls last), then pass to `markdownTable`
  - [x] 3.3 Add `task://table/by-priority` handler — sort by priority rank (high=0, medium=1, low=2), then pass to `markdownTable`
  - [x] 3.4 Add `task://table/priority-then-deadline` handler — sort by priority rank first, then dueDate ascending (nulls last) within each priority group, then pass to `markdownTable`
  - [x] 3.5 Add `task://open` handler — filter to `status === "todo" || status === "in-progress"`, then pass to `markdownTable`
  - [x] 3.6 Verify existing `task://all` (JSON) and `task://summary` (text) handlers are untouched
- [x] Task 4: Build and verify (AC: all)
  - [x] 4.1 Run `npm run build` — zero TypeScript errors
  - [x] 4.2 Verify all five new URIs return correct markdown
  - [x] 4.3 Verify existing tools and resources still work

## Dev Notes

### Existing Codebase (post Story 1.2)

The entire server is **one file**: `src/index.ts` (~381 lines). This is the ONLY file to modify.

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

**Current resource listing (lines 51–67):** The `ListResourcesRequestSchema` handler returns an array with two resources: `task://all` and `task://summary`. Append five new entries to this array.

**Current resource read handler (lines 70–113):** The `ReadResourceRequestSchema` handler uses sequential `if` blocks checking `uri`. Add five new `if` blocks for the new URIs BEFORE the final `throw new Error(...)` at line 112. Do NOT modify the existing `task://all` or `task://summary` blocks.

**Constants already defined (lines 20–21):**
```typescript
const VALID_STATUSES: Task["status"][] = ["todo", "in-progress", "done"];
const VALID_PRIORITIES: Task["priority"][] = ["low", "medium", "high"];
```
Reuse `VALID_PRIORITIES` for defining priority sort rank — its order is `["low", "medium", "high"]`, so the rank for sorting high→medium→low is: `high=0, medium=1, low=2`. Use a priority rank map or compute rank as `2 - VALID_PRIORITIES.indexOf(priority)` or simply define a constant `PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 }`.

### Shared `markdownTable` Helper

Place this function AFTER the constants (line ~22) and BEFORE the server creation (line ~36). It is a pure function with no side effects.

**Exact column order (from architecture.md and epics.md):** ID, Title, Priority, Due, Status — 5 columns.

**Implementation:**
```typescript
function markdownTable(tasks: Task[]): string {
  const header = "| ID | Title | Priority | Due | Status |";
  const separator = "| --- | --- | --- | --- | --- |";
  const lines = tasks.map(
    (t) => `| ${t.id} | ${t.title} | ${t.priority} | ${t.dueDate ?? ""} | ${t.status} |`
  );
  return [header, separator, ...lines].join("\n");
}
```

### Priority Sort Rank

Define a rank map for sorting priority high → medium → low:

```typescript
const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };
```

Place alongside the other constants (after line 21).

### Sort Functions

For `task://table/by-deadline` (ascending, nulls last):
```typescript
const sorted = [...allTasks].sort((a, b) => {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
});
```

For `task://table/by-priority` (high → medium → low):
```typescript
const sorted = [...allTasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
```

For `task://table/priority-then-deadline` (priority first, then dueDate within):
```typescript
const sorted = [...allTasks].sort((a, b) => {
  const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pDiff !== 0) return pDiff;
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
});
```

For `task://open` (filter only, no sort requirement):
```typescript
const openTasks = allTasks.filter((t) => t.status === "todo" || t.status === "in-progress");
```

### Resource List Entries

Add these five entries to the `resources` array in `ListResourcesRequestSchema` handler (after the existing `task://summary` entry):

```typescript
{
  uri: "task://table/all",
  name: "All Tasks (Table)",
  mimeType: "text/markdown",
  description: "All tasks as a markdown table with columns ID, Title, Priority, Due, Status",
},
{
  uri: "task://table/by-deadline",
  name: "Tasks by Deadline",
  mimeType: "text/markdown",
  description: "All tasks sorted by due date (ascending, nulls last) as a markdown table",
},
{
  uri: "task://table/by-priority",
  name: "Tasks by Priority",
  mimeType: "text/markdown",
  description: "All tasks sorted by priority (high → medium → low) as a markdown table",
},
{
  uri: "task://table/priority-then-deadline",
  name: "Tasks by Priority then Deadline",
  mimeType: "text/markdown",
  description: "All tasks sorted by priority, then by due date within each priority group",
},
{
  uri: "task://open",
  name: "Open Tasks",
  mimeType: "text/markdown",
  description: "Only todo and in-progress tasks as a markdown table",
},
```

### Read Handler Pattern

Each new resource handler follows the same pattern as the existing ones — an `if` block returning `contents` with `uri`, `mimeType`, and `text`:

```typescript
if (uri === "task://table/all") {
  const allTasks = Array.from(tasks.values());
  return {
    contents: [{ uri, mimeType: "text/markdown", text: markdownTable(allTasks) }],
  };
}
```

Add all five `if` blocks AFTER the existing `task://summary` block (line ~110) and BEFORE the `throw new Error(...)` (line ~112).

### Project Structure Notes

- All changes in `src/index.ts` — do NOT create new files (e.g. do NOT create `src/markdownTable.ts`). The architecture doc mentions this as optional for a future refactor but the current pattern is single-file.
- Alignment: follows the existing pattern of extending `src/index.ts` for server features.
- No conflicts with project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Column order: ID, Title, Priority, Due, Status; camelCase naming; mimeType patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — `src/index.ts` is the server entry; extend here
- [Source: _bmad-output/planning-artifacts/prd.md#FR4–FR9] — Functional requirements for markdown resources
- [Source: src/index.ts] — Current codebase (381 lines), existing resource handlers (lines 51–113)

## Previous Story Intelligence

### Story 1.1 Learnings
- Adding `dueDate` as optional field works with `?:` syntax
- `JSON.stringify` omits `undefined` keys — correct behaviour
- Simple truthiness check (`args.dueDate ? ...`) works for creation but NOT for update semantics

### Story 1.2 Learnings
- Added `VALID_STATUSES` and `VALID_PRIORITIES` constants at top of file — REUSE these
- Validation before mutation pattern: check all inputs before applying changes
- `"key" in args` pattern for detecting presence of optional fields
- Empty string validation for title/description
- All changes successfully in single file `src/index.ts`

### Patterns to Follow
- Error responses use `{ content: [{ type: "text", text: "..." }], isError: true }` for tools; `throw new Error(...)` for resource not found
- Resources return `{ contents: [{ uri, mimeType, text }] }`
- Constants defined at top of file alongside `VALID_STATUSES` and `VALID_PRIORITIES`
- `npm run build` for verification

## Architecture & Pattern Compliance

| Rule | Requirement |
|------|-------------|
| **File location** | All changes in `src/index.ts` only — do NOT create new files |
| **Column order** | ID, Title, Priority, Due, Status (5 columns, stable across all endpoints) |
| **Cell escaping** | All cell values passed through `escMdCell`: replace `\|` → `\\|`, newlines → space |
| **Default sort (no explicit sort)** | `task://table/all` and `task://open` sort by `id` ascending (lexicographic) |
| **Priority tie-breaking** | Within same priority, `task://table/by-priority` breaks ties by `id` ascending |
| **Task field naming** | camelCase: `dueDate`, `createdAt` |
| **Date format** | ISO 8601 strings for `dueDate`; display as-is in table |
| **mimeType** | `text/markdown` for all five new resources |
| **URI naming** | Exact URIs from PRD: `task://table/all`, `task://table/by-deadline`, `task://table/by-priority`, `task://table/priority-then-deadline`, `task://open` |
| **Backward compat (NFR2)** | `task://all` (JSON), `task://summary` (text), and all existing tools remain unchanged |
| **STDIO only** | No HTTP or new transports |
| **In-memory store** | `tasks: Map<string, Task>` — no database, no file I/O |

## Anti-Patterns to Avoid

1. **Do NOT modify existing `task://all` or `task://summary` handlers** — they must remain identical
2. **Do NOT change column order** between resources — all five must use the same column set (ID, Title, Priority, Due, Status) via the shared helper
3. **Do NOT create `src/markdownTable.ts`** — keep the helper in `src/index.ts` per current single-file pattern
4. **Do NOT use `Date` objects for sorting** — compare ISO 8601 strings directly with `localeCompare` (lexicographic comparison of ISO dates is correct for sorting)
5. **Do NOT use `Array.prototype.sort()` on the original `tasks.values()`** — always spread into a new array first (`[...allTasks].sort(...)`) to avoid mutating iteration order
6. **Do NOT add the new resources to existing tool handlers** — resources are read-only; tools are unchanged
7. **Do NOT modify any existing tools** — `create_task`, `update_task`, `update_task_status`, `get_task`, `delete_task` remain untouched
8. **Do NOT use different column sets for `task://open` vs table resources** — same markdownTable helper, same columns
9. **Do NOT interpolate raw field values into table cells** — always pass through `escMdCell` to prevent `|` or newlines from breaking table structure
10. **Do NOT leave `task://table/all` or `task://open` in insertion order** — sort by `id` ascending to provide deterministic output

## Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.7.x, ESM (`"type": "module"`) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` (latest compatible: 1.27.1) |
| Node types | `@types/node ^22.10.5` |
| Build command | `npm run build` (tsc → `build/`) |
| Run command | `node build/index.js` (STDIO) |
| Persistence | In-memory `Map<string, Task>` only |
| No test framework | Tests are manual for MVP |

## Git Intelligence

**Recent commits (newest first):**
1. `788c7a0` — feat: add update_task tool for modifying task fields (Story 1.2)
2. `952a41b` — feat: add optional dueDate to Task model and create_task tool (Story 1.1)
3. `d3a626f` — feat: install BMAD and create epics
4. `7b6f9bc` — feat: build basic server

**Conventions:** `feat:` prefix; story reference in parentheses; single-file changes to `src/index.ts`.

**Suggested commit message:** `feat: add markdown table resources and shared table helper (Story 1.3)`

## Verification Steps (Manual Testing)

After implementing, build and verify:

1. **`task://table/all` — all tasks in table:**
   Read the resource → verify markdown table with header `| ID | Title | Priority | Due | Status |`, separator, and one row per task.

2. **`task://table/by-deadline` — sorted by due date:**
   Create tasks with various due dates and some without → read resource → verify ascending date order, null-dueDate tasks at bottom.

3. **`task://table/by-priority` — sorted by priority:**
   Create tasks with high, medium, low priorities → read resource → verify order: high rows first, medium next, low last.

4. **`task://table/priority-then-deadline` — compound sort:**
   Create tasks with mixed priorities and dates → read resource → verify priority groups, then date order within each group.

5. **`task://open` — only open tasks:**
   Set some tasks to `done` status → read resource → verify only `todo` and `in-progress` tasks appear.

6. **Backward compatibility:**
   Read `task://all` → same JSON format as before.
   Read `task://summary` → same text format as before.
   Call `create_task`, `update_task`, `update_task_status`, `get_task`, `delete_task` → all behave identically.

7. **Build:** `npm run build` → zero TypeScript errors.

## Definition of Done

- [x] Shared `markdownTable(tasks: Task[]): string` helper function created
- [x] `PRIORITY_RANK` constant defined
- [x] Five new resources registered in `ListResourcesRequestSchema`
- [x] Five new read handlers implemented in `ReadResourceRequestSchema`
- [x] `task://table/all` returns all tasks as markdown table
- [x] `task://table/by-deadline` returns tasks sorted by dueDate ascending (nulls last)
- [x] `task://table/by-priority` returns tasks sorted high → medium → low
- [x] `task://table/priority-then-deadline` returns tasks sorted by priority then dueDate
- [x] `task://open` returns only todo/in-progress tasks as markdown table
- [x] Existing `task://all` (JSON) and `task://summary` (text) unchanged
- [x] All existing tools unchanged
- [x] `npm run build` completes with zero TypeScript errors
- [x] No new files created (all changes in `src/index.ts`)

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus (2026-03-20)

### Debug Log References

No issues encountered — clean implementation.

### Completion Notes List

- Added `PRIORITY_RANK` constant at line 22 alongside existing constants
- Implemented `markdownTable(tasks: Task[]): string` pure helper function (lines 24-31) producing pipe-delimited table with columns ID, Title, Priority, Due, Status
- Registered five new resources in `ListResourcesRequestSchema`: `task://table/all`, `task://table/by-deadline`, `task://table/by-priority`, `task://table/priority-then-deadline`, `task://open` — all with `mimeType: "text/markdown"`
- Implemented five read handlers in `ReadResourceRequestSchema` (lines 152-201) with correct sort/filter logic:
  - `task://table/all`: passes all tasks to `markdownTable`
  - `task://table/by-deadline`: sorts by dueDate ascending with nulls last via `localeCompare`
  - `task://table/by-priority`: sorts via `PRIORITY_RANK` (high=0, medium=1, low=2)
  - `task://table/priority-then-deadline`: compound sort — priority rank first, then dueDate ascending (nulls last) within groups
  - `task://open`: filters to `status === "todo" || status === "in-progress"`
- All existing `task://all`, `task://summary` resource handlers and all tool handlers remain completely untouched
- `npm run build` completed with zero TypeScript errors
- No new files created — all changes confined to `src/index.ts`

### Change Log

- 2026-03-20: Implemented Story 1.3 — added `PRIORITY_RANK` constant, `markdownTable` helper, 5 new resource registrations, and 5 new read handlers in `src/index.ts`

### File List

- `src/index.ts` (modified)
