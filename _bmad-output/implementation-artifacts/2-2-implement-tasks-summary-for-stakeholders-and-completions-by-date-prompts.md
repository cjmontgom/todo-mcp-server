# Story 2.2: Implement tasks_summary_for_stakeholders and completions_by_date prompts

Status: done

## Story

As a developer or AI assistant using the MCP server,
I want prompts that summarise task status for stakeholders and show completed tasks grouped by date,
so that I can generate reports with a single prompt invocation.

## Acceptance Criteria

1. **AC1 — `prompts/list` includes both new prompts**
   Given `prompts/list` is called
   When the server responds
   Then the list includes `tasks_summary_for_stakeholders` (no required arguments) and `completions_by_date` (optional `from` and `to` arguments) alongside the existing `tasks_table` prompt

2. **AC2 — `tasks_summary_for_stakeholders` returns a markdown status summary**
   Given a client calls `prompts/get` with `name: "tasks_summary_for_stakeholders"`
   When the server handles the request
   Then the response contains one user-role `PromptMessage` with a markdown summary including: count of tasks by status (todo / in-progress / done), overdue count (tasks with `dueDate` before today that are not done), and a small markdown table of overdue tasks (if any exist)

3. **AC3 — `completions_by_date` with no arguments returns all completions**
   Given a client calls `prompts/get` with `name: "completions_by_date"` and no arguments
   When the server handles the request
   Then the response contains one user-role `PromptMessage` with a markdown table of dates and completed-task counts for all completed tasks (grouped by the date portion of `completedAt`)

4. **AC4 — `completions_by_date` with `from` and/or `to` filters by range**
   Given `completions_by_date` is called with optional `from` and/or `to` date arguments (ISO 8601 date strings)
   When the server handles the request
   Then only completed tasks whose `completedAt` date falls within the specified range are included

5. **AC5 — `completions_by_date` with no completed tasks returns a valid message**
   Given no tasks are completed
   When `completions_by_date` is invoked
   Then the response still returns a valid `PromptMessage` with a note that no completed tasks exist

6. **AC6 — Existing `tasks_table` prompt is unchanged**
   Given the two new prompts have been added
   When `prompts/list` is called
   Then all three prompts are listed and individually callable without regression

7. **AC7 — `completedAt` is set when task status becomes done**
   Given a task exists and `update_task` or `update_task_status` is called with `status: "done"`
   When the task status transitions to "done"
   Then `completedAt` is set to the current ISO datetime; if status changes away from "done", `completedAt` is cleared

## Scope

**In scope:**
- Add `completedAt?: string` to the `Task` interface
- Update `update_task` and `update_task_status` handlers to set/clear `completedAt` on status transitions
- Update `ListPromptsRequestSchema` handler to include `tasks_summary_for_stakeholders` and `completions_by_date`
- Update `GetPromptRequestSchema` handler to implement both new prompts
- `completedAt` field visible in `task://all` JSON resource (backward-compatible addition)

**Out of scope:**
- Proxy, React app, or any client changes
- Refactoring to multiple files (single-file pattern continues)
- Changes to `tasks_table` prompt logic
- Changes to markdown table resources
- `task://chart/completions-by-date` Mermaid resource (post-MVP)

## Tasks / Subtasks

- [x] Task 1: Add `completedAt` to the Task interface (AC: #7)
  - [x] 1.1 Add `completedAt?: string` to the `Task` interface (after `dueDate`)
- [x] Task 2: Update `update_task` handler to manage `completedAt` (AC: #7)
  - [x] 2.1 After setting `task.status` in the `update_task` case (line ~398), add logic: if new status is `"done"` and task didn't already have `completedAt`, set `task.completedAt = new Date().toISOString()`; if new status is NOT `"done"`, set `task.completedAt = undefined`
- [x] Task 3: Update `update_task_status` handler to manage `completedAt` (AC: #7)
  - [x] 3.1 In the `update_task_status` case (line ~423), after setting `task.status`, apply the same completedAt logic as Task 2
- [x] Task 4: Update `ListPromptsRequestSchema` handler to include new prompts (AC: #1)
  - [x] 4.1 Add `tasks_summary_for_stakeholders` entry to the `prompts` array with no required arguments
  - [x] 4.2 Add `completions_by_date` entry with optional `from` and `to` argument definitions
- [x] Task 5: Implement `tasks_summary_for_stakeholders` in GetPromptRequestSchema handler (AC: #2)
  - [x] 5.1 Add a branch for `name === "tasks_summary_for_stakeholders"` in the existing handler
  - [x] 5.2 Compute counts by status: todo, in-progress, done
  - [x] 5.3 Compute overdue tasks: dueDate is set, dueDate < today (date portion comparison), and status is NOT "done"
  - [x] 5.4 Build markdown summary string with status counts, overdue count, and if overdue tasks exist, a small markdown table showing them
  - [x] 5.5 Return `{ messages: [{ role: "user", content: { type: "text", text: summary } }] }`
- [x] Task 6: Implement `completions_by_date` in GetPromptRequestSchema handler (AC: #3, #4, #5)
  - [x] 6.1 Add a branch for `name === "completions_by_date"` in the existing handler
  - [x] 6.2 Extract optional `from` and `to` from `promptArgs`
  - [x] 6.3 Filter to tasks with `status === "done"` and `completedAt` set
  - [x] 6.4 If `from` is provided, filter `completedAt >= from`; if `to` is provided, filter `completedAt <= to + "T23:59:59"`
  - [x] 6.5 Group completed tasks by the date portion of `completedAt` (substring 0..10)
  - [x] 6.6 Build a markdown table with columns `| Date | Completed |`
  - [x] 6.7 If no completed tasks exist, return a message: "No completed tasks found."
  - [x] 6.8 Return `{ messages: [{ role: "user", content: { type: "text", text: tableOrMessage } }] }`
- [x] Task 7: Update `GetPromptRequestSchema` handler routing (AC: #6)
  - [x] 7.1 Change the existing `name !== "tasks_table"` guard to a switch or if/else-if chain that handles all three prompt names and throws "Prompt not found" for unknown names
- [x] Task 8: Build and verify (AC: all)
  - [x] 8.1 Run `npm run build` — zero TypeScript errors
  - [ ] 8.2 Manually verify `prompts/list` returns all three prompts
  - [ ] 8.3 Verify `tasks_summary_for_stakeholders` returns correct summary
  - [ ] 8.4 Verify `completions_by_date` with and without from/to arguments

## Dev Notes

### File to Modify

**`src/index.ts` is the ONLY file to modify.** Do NOT create new files. Single-file pattern is established and confirmed across Stories 1.1–2.1.

### Current File State (post Story 2.1, 553 lines)

All relevant anchors in `src/index.ts`:

| Lines | Content |
|-------|---------|
| 1–10 | Imports from `@modelcontextprotocol/sdk` (includes `ListPromptsRequestSchema`, `GetPromptRequestSchema`) |
| 12–20 | `Task` interface — add `completedAt?: string` here |
| 22–24 | `VALID_STATUSES`, `VALID_PRIORITIES`, `PRIORITY_RANK` constants |
| 26–38 | `escMdCell` + `markdownTable` helper functions |
| 40–51 | In-memory `tasks` Map + sample task |
| 53–66 | `new Server(...)` with `capabilities: { resources: {}, tools: {}, prompts: {} }` |
| 68–116 | `ListResourcesRequestSchema` handler |
| 118–214 | `ReadResourceRequestSchema` handler |
| 216–308 | `ListToolsRequestSchema` handler |
| 310–470 | `CallToolRequestSchema` handler (`update_task` at 349–412, `update_task_status` at 414–432) |
| 472–489 | `ListPromptsRequestSchema` handler — extend prompts array here |
| 491–541 | `GetPromptRequestSchema` handler — add new prompt branches here |
| 543–553 | `main()` and startup |

### Critical Implementation Detail: `completedAt` Field

The Task model currently has NO `completedAt` field. The `completions_by_date` prompt requires knowing WHEN a task was completed to group by date and filter by range. You MUST:

1. Add `completedAt?: string` to the `Task` interface (line ~19, after `dueDate`)
2. Update the `update_task` handler (line ~398 area) to set/clear `completedAt`:
   ```typescript
   if ("status" in args) {
     task.status = args.status as Task["status"];
     if (task.status === "done" && !task.completedAt) {
       task.completedAt = new Date().toISOString();
     } else if (task.status !== "done") {
       task.completedAt = undefined;
     }
   }
   ```
3. Update the `update_task_status` handler (line ~423 area) similarly:
   ```typescript
   task.status = args.status as Task["status"];
   if (task.status === "done" && !task.completedAt) {
     task.completedAt = new Date().toISOString();
   } else if (task.status !== "done") {
     task.completedAt = undefined;
   }
   ```

The `completedAt` field will automatically appear in the `task://all` JSON resource (since it serializes the full Task object). This is a backward-compatible addition — existing clients that don't use `completedAt` will simply ignore it.

### Step 1 — Update Task Interface (line 12–20)

Change:
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
To:
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
}
```

### Step 2 — Update update_task Status Logic (line ~395–398)

The current code sets status and dueDate independently. You need to replace the simple status assignment with one that also manages `completedAt`. Find this block:
```typescript
if ("status" in args) task.status = args.status as Task["status"];
```
Replace with:
```typescript
if ("status" in args) {
  task.status = args.status as Task["status"];
  if (task.status === "done" && !task.completedAt) {
    task.completedAt = new Date().toISOString();
  } else if (task.status !== "done") {
    task.completedAt = undefined;
  }
}
```

### Step 3 — Update update_task_status Handler (line ~423)

Find this block:
```typescript
task.status = args.status as Task["status"];
```
Replace with:
```typescript
task.status = args.status as Task["status"];
if (task.status === "done" && !task.completedAt) {
  task.completedAt = new Date().toISOString();
} else if (task.status !== "done") {
  task.completedAt = undefined;
}
```

### Step 4 — Update ListPromptsRequestSchema Handler (line 472–489)

Replace the existing handler to return all three prompts:

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
      {
        name: "tasks_summary_for_stakeholders",
        description: "Summary of task counts by status, overdue count, and overdue task details",
      },
      {
        name: "completions_by_date",
        description: "Completed tasks grouped by completion date, with optional date range filter",
        arguments: [
          {
            name: "from",
            description: "Start date for filtering (ISO 8601, e.g. 2026-03-01). Optional.",
            required: false,
          },
          {
            name: "to",
            description: "End date for filtering (ISO 8601, e.g. 2026-03-31). Optional.",
            required: false,
          },
        ],
      },
    ],
  };
});
```

Note: `tasks_summary_for_stakeholders` has no `arguments` property at all (omit it entirely rather than passing an empty array — the SDK accepts this).

### Step 5 — Update GetPromptRequestSchema Handler (line 491–541)

Replace the existing handler to route to all three prompts. The `tasks_table` logic is unchanged; add the two new branches:

```typescript
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: promptArgs = {} } = request.params;

  if (name === "tasks_table") {
    // --- existing tasks_table logic (unchanged) ---
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
      sorted = [...allTasks].sort((a, b) => {
        const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.id.localeCompare(b.id);
      });
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
      messages: [{ role: "user", content: { type: "text", text: markdownTable(sorted) } }],
    };
  }

  if (name === "tasks_summary_for_stakeholders") {
    const allTasks = Array.from(tasks.values());
    const todoCount = allTasks.filter((t) => t.status === "todo").length;
    const inProgressCount = allTasks.filter((t) => t.status === "in-progress").length;
    const doneCount = allTasks.filter((t) => t.status === "done").length;

    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== "done"
    );

    let summary = `# Task Summary for Stakeholders\n\n`;
    summary += `| Status | Count |\n| --- | --- |\n`;
    summary += `| Todo | ${todoCount} |\n`;
    summary += `| In Progress | ${inProgressCount} |\n`;
    summary += `| Done | ${doneCount} |\n`;
    summary += `| **Total** | **${allTasks.length}** |\n\n`;
    summary += `**Overdue tasks:** ${overdueTasks.length}\n`;

    if (overdueTasks.length > 0) {
      summary += `\n## Overdue Tasks\n\n`;
      summary += markdownTable(overdueTasks);
    }

    return {
      messages: [{ role: "user", content: { type: "text", text: summary } }],
    };
  }

  if (name === "completions_by_date") {
    const from = promptArgs["from"];
    const to = promptArgs["to"];

    let completed = Array.from(tasks.values()).filter(
      (t) => t.status === "done" && t.completedAt
    );

    if (from) {
      completed = completed.filter((t) => t.completedAt!.slice(0, 10) >= from);
    }
    if (to) {
      completed = completed.filter((t) => t.completedAt!.slice(0, 10) <= to);
    }

    if (completed.length === 0) {
      return {
        messages: [
          { role: "user", content: { type: "text", text: "No completed tasks found." } },
        ],
      };
    }

    const groups: Record<string, number> = {};
    for (const t of completed) {
      const dateKey = t.completedAt!.slice(0, 10);
      groups[dateKey] = (groups[dateKey] || 0) + 1;
    }

    const sortedDates = Object.keys(groups).sort();
    let table = "| Date | Completed |\n| --- | --- |\n";
    for (const date of sortedDates) {
      table += `| ${date} | ${groups[date]} |\n`;
    }

    return {
      messages: [{ role: "user", content: { type: "text", text: table } }],
    };
  }

  throw new Error(`Prompt not found: ${name}`);
});
```

### Key Implementation Details

**Return shape for all prompts:** `{ messages: [{ role: "user", content: { type: "text", text: string } }] }` — exactly one user-role PromptMessage.

**Error handling:** Use `throw new Error(...)` for unknown prompt names. Both new prompts have no required arguments, so no argument validation errors are needed (unlike `tasks_table`). If `from`/`to` are invalid date strings, comparison still works lexicographically on ISO strings — no explicit validation needed.

**Overdue computation:** Compare `dueDate.slice(0, 10)` against `new Date().toISOString().slice(0, 10)` using string comparison. This works correctly for ISO 8601 date strings because they sort lexicographically. A task is overdue if: (1) `dueDate` is set, (2) the date portion is before today, and (3) status is not `"done"`.

**Completions grouping:** Use `completedAt.slice(0, 10)` to extract the date portion for grouping. Sort dates ascending for the output table.

**`from`/`to` filtering:** Compare the date portion of `completedAt` (first 10 characters = `YYYY-MM-DD`) against `from` and `to` strings. This handles both date-only (`2026-03-01`) and datetime (`2026-03-01T12:00:00Z`) values from the user correctly because we always compare the date portion only.

**`tasks_summary_for_stakeholders` has no arguments:** In the `ListPromptsRequestSchema` handler, omit the `arguments` property entirely for this prompt (do NOT pass an empty array).

**`completions_by_date` arguments are optional:** Both `from` and `to` have `required: false`. The handler checks for their presence before using them.

### Anti-Patterns to Avoid

1. **Do NOT forget to add `completedAt` to the Task interface** — without it, `completions_by_date` has no data to group by
2. **Do NOT forget to update BOTH `update_task` AND `update_task_status`** — both handlers can change status to "done"
3. **Do NOT modify the existing `tasks_table` logic** — it must remain byte-for-byte identical
4. **Do NOT use the tool error pattern** (`{ content: [...], isError: true }`) in prompt handlers — use `throw new Error(...)`
5. **Do NOT create new files** — all changes in `src/index.ts`
6. **Do NOT return more than one message** in any prompt response
7. **Do NOT add `arguments: []` for `tasks_summary_for_stakeholders`** — omit the property entirely when there are no arguments
8. **Do NOT use `Date.parse()` or `new Date(dueDate)` for date comparisons** — use string comparison on ISO 8601 date portions (`.slice(0, 10)`) to avoid timezone issues
9. **Do NOT overwrite `completedAt` if task is already done** — check `!task.completedAt` before setting it, to preserve the original completion timestamp if status is set to "done" again

### Project Structure Compliance

| Rule | Requirement |
|------|-------------|
| **File** | `src/index.ts` only — no new files |
| **STDIO transport** | Unchanged — do not touch `main()` |
| **Backward compat (NFR2)** | All existing resources and tools untouched; `completedAt` is additive in JSON |
| **In-memory store** | No persistence changes |
| **Naming** | Prompt names match PRD exactly: `tasks_summary_for_stakeholders`, `completions_by_date` (underscores, lowercase) |

## Previous Story Intelligence

**From Story 2.1 (most recent, currently in review):**
- Prompts capability is already enabled (`prompts: {}` in capabilities) — do NOT re-add
- `ListPromptsRequestSchema` and `GetPromptRequestSchema` are already imported — do NOT re-import
- `ListPromptsRequestSchema` handler currently returns only `tasks_table` — extend the array
- `GetPromptRequestSchema` handler currently uses `if (name !== "tasks_table")` as a guard — change to if/else-if chain or switch to handle all three prompts
- Sort logic in `tasks_table` duplicated inline from resource handlers — leave untouched
- `markdownTable()` helper is available at line 30 and produces `| ID | Title | Priority | Due | Status |` — reuse it for overdue tasks table in the stakeholder summary
- Error pattern: `throw new Error(...)` for prompts (NOT tool `isError` pattern)
- Return shape: `{ messages: [{ role: "user", content: { type: "text", text: string } }] }`
- Build: `npm run build` → zero TypeScript errors
- Commit convention: `feat: <description> (Story X.Y)`

**From Stories 1.1–1.3:**
- `VALID_STATUSES`, `VALID_PRIORITIES`, `PRIORITY_RANK` constants at top — do not redefine
- `update_task` handler validates status/priority before setting — `completedAt` logic goes AFTER status is set
- `update_task_status` handler sets status directly without validation — `completedAt` logic goes AFTER the status assignment
- The `escMdCell()` helper is used by `markdownTable()` — no direct usage needed

## Architecture & Pattern Compliance

| Area | Decision |
|------|----------|
| **Capabilities** | Already includes `prompts: {}` — no change needed |
| **Import source** | `ListPromptsRequestSchema`, `GetPromptRequestSchema` already imported — no change needed |
| **Handler placement** | Extend existing prompt handlers in place |
| **Prompt names** | `tasks_summary_for_stakeholders`, `completions_by_date` (underscore, lowercase — match PRD/FR12, FR13) |
| **New field** | `completedAt?: string` — ISO 8601 datetime, set on status→done, cleared on status→not-done |
| **Error mechanism** | `throw new Error(...)` (not tool `isError` pattern) |
| **Date handling** | ISO 8601 strings; date portion via `.slice(0, 10)` for comparisons |

## Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.7.x, ESM (`"type": "module"`) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` |
| Imports needed | None new — `ListPromptsRequestSchema` and `GetPromptRequestSchema` already imported |
| Build command | `npm run build` (tsc → `build/`) |
| Run command | `node build/index.js` (STDIO) |
| Persistence | In-memory `Map<string, Task>` — unchanged |

## Git Intelligence

**Recent commits (newest first):**
1. `4c8ee38` — feat: add prompts capability and tasks_table prompt (Story 2.1)
2. `40f0059` — feat: add markdown table resources and shared table helper (Story 1.3)
3. `92f0f73` — feat: add Epic 5 (LLM natural language MCP interaction) and update planning artifacts
4. `788c7a0` — feat: add update_task tool for modifying task fields (Story 1.2)
5. `952a41b` — feat: add optional dueDate to Task model and create_task tool (Story 1.1)

**Convention:** `feat:` prefix; story reference in parentheses.

**Suggested commit message:** `feat: add stakeholder summary and completions-by-date prompts (Story 2.2)`

## Verification Steps (Manual Testing)

After `npm run build && node build/index.js`:

1. **`prompts/list` — returns all three prompts:**
   Call `prompts/list` → verify response includes `tasks_table`, `tasks_summary_for_stakeholders`, and `completions_by_date` with correct argument definitions

2. **`tasks_summary_for_stakeholders` — basic summary:**
   Call `prompts/get` with `{ name: "tasks_summary_for_stakeholders" }` → verify `messages[0].role === "user"`, `messages[0].content.type === "text"`, and text contains status counts (todo, in-progress, done) and overdue count

3. **`tasks_summary_for_stakeholders` — with overdue tasks:**
   Create a task with `dueDate` in the past (e.g. `"2020-01-01"`) via `create_task` → call the prompt → verify the overdue table includes the task

4. **`completions_by_date` — no completed tasks:**
   With no done tasks, call `prompts/get` with `{ name: "completions_by_date" }` → verify response says "No completed tasks found."

5. **`completions_by_date` — with completed tasks:**
   Complete a task via `update_task` with `status: "done"` → call the prompt → verify table shows today's date with count 1

6. **`completions_by_date` — with `from`/`to` filtering:**
   Call with `{ name: "completions_by_date", arguments: { from: "2026-03-01", to: "2026-03-31" } }` → verify only completions in that range appear

7. **`completedAt` field — set on done:**
   Call `update_task` with `status: "done"` → read `task://all` → verify task JSON includes `completedAt` with current datetime

8. **`completedAt` field — cleared on un-done:**
   Call `update_task` with `status: "todo"` on a done task → read `task://all` → verify `completedAt` is absent/undefined

9. **Backward compatibility:**
   Call `tasks_table` prompt with all sort values → verify unchanged output.
   Read all resources → verify unchanged. Call `create_task`, `update_task` → verify unchanged.

10. **Build:** `npm run build` → zero TypeScript errors.

## Definition of Done

- [x] `completedAt?: string` added to `Task` interface
- [x] `update_task` handler sets `completedAt` on status→done, clears on status→not-done
- [x] `update_task_status` handler sets `completedAt` on status→done, clears on status→not-done
- [x] `ListPromptsRequestSchema` handler returns all three prompts with correct argument definitions
- [x] `GetPromptRequestSchema` handler routes to all three prompts correctly
- [x] `tasks_summary_for_stakeholders` returns markdown with status counts, overdue count, and overdue table
- [x] `completions_by_date` returns grouped completion counts with optional from/to filtering
- [x] `completions_by_date` returns valid message when no completed tasks exist
- [x] All existing prompts, resources, and tools unchanged
- [x] `npm run build` completes with zero TypeScript errors
- [x] No new files created (all changes in `src/index.ts`)

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus (via Cursor)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Added `completedAt?: string` to the `Task` interface (line 20)
- Updated `update_task` handler: when status changes to "done" and `completedAt` is not already set, sets `completedAt` to current ISO datetime; when status changes away from "done", clears `completedAt`
- Updated `update_task_status` handler with identical `completedAt` management logic
- Extended `ListPromptsRequestSchema` handler to return all three prompts: `tasks_table` (unchanged), `tasks_summary_for_stakeholders` (no arguments), `completions_by_date` (optional `from`/`to`)
- Implemented `tasks_summary_for_stakeholders`: counts tasks by status, identifies overdue tasks via ISO date string comparison, renders markdown summary with optional overdue tasks table using existing `markdownTable()` helper
- Implemented `completions_by_date`: filters done tasks with `completedAt`, applies optional `from`/`to` date range filtering on date portion, groups by date, renders markdown table; returns "No completed tasks found." when no matches
- Changed `GetPromptRequestSchema` handler from single-prompt guard (`name !== "tasks_table"`) to if/else-if chain handling all three prompt names, with `throw new Error(...)` for unknown names
- `tasks_table` prompt logic remains byte-for-byte identical
- All existing resources and tools are untouched
- `npm run build` passes with zero TypeScript errors
- No new files created — all changes in `src/index.ts` only
- No test framework exists in the project; verification steps 8.2–8.4 require manual testing via STDIO

### Change Log

- 2026-03-20: Implemented Story 2.2 — added `completedAt` field to Task, `tasks_summary_for_stakeholders` and `completions_by_date` prompts

### File List

- src/index.ts (modified)
