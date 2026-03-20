# Story 4.4: Invoke a Prompt with arguments and see tabular results in AG Grid

Status: done

## Story

As a learner,
I want to select a prompt, fill in any arguments, invoke it, and see the returned content with a note explaining it came from a Prompt,
so that I understand what MCP Prompts are and how they differ from Resources and Tools.

## Acceptance Criteria

1. **AC1 — Selected prompt renders argument form**
   Given the Prompts section is populated
   When a user selects a prompt (e.g. `tasks_table`)
   Then an argument form is displayed with fields matching the prompt's argument definitions (e.g. `sort` as a text input with description hint) (FR24, UX-DR3)

2. **AC2 — Invoke calls `prompts/get` and displays result**
   Given the argument form is filled (or empty for prompts with no required args)
   When the user clicks Invoke
   Then the app calls `prompts/get` with the prompt name and arguments and displays the returned message content (FR24)

3. **AC3 — Tabular result shown in AG Grid with prompt note**
   Given the returned `PromptMessage` content is a markdown table with task columns (ID, Title, Priority, Due, Status)
   When the result is displayed
   Then the app parses the markdown table into row objects and shows them in AG Grid with a note: "This content came from a Prompt — shown here in the grid." (FR24, UX-DR2, UX-DR4)

4. **AC4 — Non-tabular result shown as formatted text**
   Given the returned content is a text summary (e.g. `tasks_summary_for_stakeholders`)
   When the result is displayed
   Then the content is rendered as pre-formatted text; where the text contains a parseable task table (e.g. overdue tasks with ID/Title columns), those rows are shown in AG Grid (FR24)

5. **AC5 — Invoke button loading state during in-flight call**
   Given a `prompts/get` request is in-flight
   When the user waits
   Then the Invoke button shows a loading state and is disabled (UX-DR8)

6. **AC6 — Error shown inline, form preserved**
   Given `prompts/get` returns an error
   When the error is received
   Then an inline error message is shown; the argument form remains filled (UX-DR7)

## Tasks / Subtasks

- [x] Task 1: Add `getPrompt` to `client/src/mcp/client.ts` (AC: #2, #3, #4)
  - [x] 1.1 Export `PromptMessage` interface: `{ role: string; content: { type: string; text?: string } }`
  - [x] 1.2 Export `PromptResult` interface: `{ messages: PromptMessage[] }`
  - [x] 1.3 Export `getPrompt(promptName: string, args: Record<string, string>): Promise<PromptResult>` that calls `sendJsonRpc("prompts/get", { name: promptName, arguments: args })` and returns the typed result
  - [x] 1.4 Call `ensureInitialized()` before the request (same pattern as all other client functions)
  - [x] 1.5 Validate response shape: throw if `result` is falsy or `result.messages` is missing or not an array

- [x] Task 2: Add copy key to `client/src/copy/mcpExplainer.ts` (AC: #3)
  - [x] 2.1 Add `gridNotePrompt`: `"This content came from a Prompt — shown here in the grid."`

- [x] Task 3: Rewrite `client/src/components/PromptsPanel.tsx` (AC: #1–#6)
  - [x] 3.1 Add `selectedPrompt: Prompt | null` state (init `null`); clicking an item-card sets it
  - [x] 3.2 Add `argValues: Record<string, string>` state (init `{}`); reset when selected prompt changes
  - [x] 3.3 Add `invokeState: { status: 'idle' | 'loading' | 'error' | 'success'; text?: string; rows?: GridRow[]; error?: string }` state (init `{ status: 'idle' }`)
  - [x] 3.4 Implement `handleSelect(prompt)` — sets `selectedPrompt`, resets `argValues` to `{}`, resets `invokeState` to idle
  - [x] 3.5 Implement `handleArgChange(name, value)` — updates `argValues[name]`
  - [x] 3.6 Implement `handleInvoke(e)` — validates required args, sets invokeState to loading; builds `args` (only non-empty strings); calls `getPrompt`; on success: extracts text from all messages, tries `parseMarkdownTable`, checks if rows have meaningful data, sets `invokeState.success`; on error: sets `invokeState.error`
  - [x] 3.7 Render: prompt-list section with clickable item-cards (add `item-card--selected` + `role="button"` + `tabIndex={0}` + keyboard handler)
  - [x] 3.8 Render: prompt argument form below the list when `selectedPrompt !== null`
  - [x] 3.9 Render form fields from `prompt.arguments` array — all arguments are text inputs (no enum/date detection needed)
  - [x] 3.10 Render Invoke button with loading state: `<button type="submit" className="submit-btn" disabled={invokeState.status === 'loading'}>` with spinner span when loading
  - [x] 3.11 Render invoke-result section: error | success with grid (if tabular rows) | text (pre-formatted)
  - [x] 3.12 Import `TaskGrid`, `GridRow`, `parseMarkdownTable`, `getPrompt`, `PromptResult`, `MCP_COPY`

- [x] Task 4: Verify CSS (no new classes required — reuse existing)
  - [x] 4.1 Confirm `.tool-form`, `.tool-form-field`, `.submit-btn`, `.call-result`, `.tool-text-result` all exist in `index.css` and apply correctly to PromptsPanel

- [x] Task 5: Build and verify (AC: all)
  - [x] 5.1 `cd client && npm run build` — zero TypeScript errors
  - [x] 5.2 `cd client && npm run lint` — zero ESLint errors
  - [ ] 5.3 `cd proxy && npm run dev` — proxy starts on 3001
  - [ ] 5.4 `cd client && npm run dev` — client starts on 5173
  - [ ] 5.5 Click `tasks_table` → form appears with a `sort` text input (placeholder from description)
  - [ ] 5.6 Fill `sort` = `deadline` → click Invoke → loading state on button; task table appears in AG Grid with "This content came from a Prompt — shown here in the grid." note
  - [ ] 5.7 Click `tasks_summary_for_stakeholders` → form shows "No arguments" or empty state → click Invoke → summary text displays in `<pre>` (and overdue table in AG Grid if any overdue tasks exist)
  - [ ] 5.8 Click `completions_by_date` → form shows `from` and `to` text inputs → Invoke with empty args → completions text displayed
  - [ ] 5.9 Enter invalid sort value (e.g. `bogus`) for `tasks_table` → inline error shown; arg form still filled
  - [ ] 5.10 Stop proxy → Invoke → inline error (proxy unreachable); form still filled
  - [ ] 5.11 Click a different prompt while result is shown → form and result clear, new form renders
  - [ ] 5.12 Verify ResourcesPanel, ToolsPanel, App.tsx unchanged (regression check)

## Dev Notes

### Architecture Overview

This story adds the Prompt Invoke flow to the existing PromptsPanel scaffold from Story 4.1. The flow mirrors the ToolsPanel pattern from Story 4.3 closely — but with simpler argument handling (all text inputs, no schema enum detection):

```
User clicks prompt card
  → PromptsPanel.handleSelect(prompt)
    → form renders with argument fields (from prompt.arguments array)

User fills args + clicks Invoke
  → PromptsPanel.handleInvoke()
    → validate required args → show error or proceed
    → getPrompt(name, args) [new client.ts export]
      → POST /mcp  {method: "prompts/get", params: {name, arguments: args}}
        → Proxy forwards to MCP server
        → Returns {messages: [{role: "user", content: {type: "text", text: "..."}}]}
    → extract text from messages[].content.text
    → try parseMarkdownTable → if rows have id/title data → TaskGrid
    → else → <pre className="tool-text-result">
```

No changes to: `src/index.ts` (MCP server), `proxy/`, root `package.json`, `McpContext.tsx`, `ResourcesPanel.tsx`, `ToolsPanel.tsx`, `TaskGrid.tsx`, `parseMarkdownTable.ts`, `taskColumns.ts`, `index.css`.

### `getPrompt` Implementation in `client/src/mcp/client.ts`

Add after `callTool`:

```typescript
export interface PromptMessage {
  role: string;
  content: { type: string; text?: string };
}

export interface PromptResult {
  messages: PromptMessage[];
}

export async function getPrompt(
  promptName: string,
  args: Record<string, string>
): Promise<PromptResult> {
  await ensureInitialized();
  const result = await sendJsonRpc("prompts/get", { name: promptName, arguments: args });
  const typed = result as { messages?: PromptMessage[] };
  if (!typed || !Array.isArray(typed.messages)) {
    throw new Error(`Unexpected response shape from prompts/get (prompt: ${promptName})`);
  }
  return { messages: typed.messages };
}
```

### `prompts/get` Wire Format

```json
// Request
{ "jsonrpc": "2.0", "id": 8, "method": "prompts/get", "params": { "name": "tasks_table", "arguments": { "sort": "deadline" } } }

// Success Response (tasks_table)
{
  "result": {
    "messages": [
      { "role": "user", "content": { "type": "text", "text": "| ID | Title | ... |" } }
    ]
  }
}

// Success Response (tasks_summary_for_stakeholders — no args needed)
{
  "result": {
    "messages": [
      { "role": "user", "content": { "type": "text", "text": "# Task Summary for Stakeholders\n\n| Status | Count |\n..." } }
    ]
  }
}

// JSON-RPC Error (invalid sort value — thrown by sendJsonRpc)
{
  "error": { "code": -32602, "message": "Invalid sort value: \"bogus\". Must be one of: deadline, priority, priority-then-deadline" }
}
```

**Key difference from `tools/call`:** No `isError` field on the result. Errors come only as JSON-RPC errors (caught by `sendJsonRpc` → thrown → caught in `handleInvoke` catch block). There is no "tool-level" error path here.

### Live Prompt Argument Definitions (from `src/index.ts`)

**`tasks_table` arguments:**
```
[{ name: "sort", description: "Sort order: 'deadline' | 'priority' | 'priority-then-deadline'", required: true }]
```

**`tasks_summary_for_stakeholders` arguments:**
```
[] (no arguments — prompt.arguments is undefined or empty array)
```

**`completions_by_date` arguments:**
```
[
  { name: "from", description: "Start date for filtering (ISO 8601, e.g. 2026-03-01). Optional.", required: false },
  { name: "to",   description: "End date for filtering (ISO 8601, e.g. 2026-03-31). Optional.", required: false }
]
```

### Argument Form Rendering

Prompt arguments are simpler than tool inputSchema — they are all string fields with no enum or type info:

```typescript
// Render each argument as a plain text input
// No getInputType() needed — all fields are text inputs
function renderArgField(
  arg: { name: string; description?: string; required?: boolean },
  value: string,
  onChange: (val: string) => void
) {
  const id = `arg-${arg.name}`;
  return (
    <div key={arg.name} className="tool-form-field">
      <label htmlFor={id}>
        {arg.name}
        {!arg.required && <span className="field-optional">(optional)</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={arg.description ?? arg.name}
      />
    </div>
  );
}
```

No `input-invalid` class needed since the only validation is "required field is empty" — show an inline error element in that case (same pattern as ToolsPanel but simpler since all fields are text).

### `handleInvoke` Implementation

```typescript
async function handleInvoke(e: React.FormEvent) {
  e.preventDefault();

  // Validate required args
  const requiredArgs = (selectedPrompt!.arguments ?? []).filter((a) => a.required);
  const errors: Record<string, string> = {};
  for (const arg of requiredArgs) {
    if (!argValues[arg.name]?.trim()) {
      errors[arg.name] = `${arg.name} is required`;
    }
  }
  if (Object.keys(errors).length > 0) {
    setArgErrors(errors);
    return;
  }

  // Build args: include only non-empty values
  const args: Record<string, string> = {};
  for (const [name, value] of Object.entries(argValues)) {
    if (value.trim() !== '') {
      args[name] = value.trim();
    }
  }

  setInvokeState({ status: 'loading' });
  try {
    const result = await getPrompt(selectedPrompt!.name, args);

    // Extract text from all messages (join with newline if multiple)
    const text = result.messages
      .filter((m) => m.content.type === 'text')
      .map((m) => m.content.text ?? '')
      .join('\n');

    // Try to parse as markdown table → AG Grid (only show grid if rows have task data)
    const rows = parseMarkdownTable(text);
    const hasTaskData = rows.some((r) => r.id || r.title);

    setInvokeState({
      status: 'success',
      text,
      rows: hasTaskData ? rows : undefined,
    });
  } catch (err) {
    setInvokeState({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

**Critical:** The `hasTaskData` check (rows with non-empty `id` or `title`) determines grid vs. text display:
- `tasks_table` → rows have `id` + `title` → AG Grid ✓
- `tasks_summary_for_stakeholders` → first table is Status/Count (columns don't map to GridRow fields) → `id` and `title` are empty strings → falls through to text display ✓
- `completions_by_date` → Date/Completed columns don't map → text display ✓
- `tasks_summary_for_stakeholders` with overdue tasks → the embedded overdue-task table has ID/Title columns → those rows have task data → AG Grid ✓ (but only if the `parseMarkdownTable` picks up the right table; since the function scans all `|`-delimited lines, the first table encountered is Status/Count which doesn't map, then overdue lines do map — so `hasTaskData` will be true if any row has id or title)

### Result Display in PromptsPanel JSX

```tsx
{(invokeState.status === 'error' || invokeState.status === 'success') && (
  <div className="call-result">
    {invokeState.status === 'error' && (
      <div className="error">{invokeState.error}</div>
    )}
    {invokeState.status === 'success' && (
      <>
        {invokeState.rows && invokeState.rows.length > 0 ? (
          <TaskGrid
            rows={invokeState.rows}
            note={MCP_COPY.gridNotePrompt}
            postAction={MCP_COPY.postActionInvoke(selectedPrompt!.name)}
          />
        ) : (
          <>
            <p className="post-action">
              {MCP_COPY.postActionInvoke(selectedPrompt!.name)}
            </p>
            {invokeState.text && (
              <pre className="tool-text-result">{invokeState.text}</pre>
            )}
          </>
        )}
      </>
    )}
  </div>
)}
```

### Prompt Handling — No Args Prompt (`tasks_summary_for_stakeholders`)

When `selectedPrompt.arguments` is undefined or empty, still render the `<form>` but with a message instead of fields:

```tsx
{selectedPrompt !== null && (
  <form className="tool-form" onSubmit={handleInvoke} noValidate>
    {(!selectedPrompt.arguments || selectedPrompt.arguments.length === 0) ? (
      <p className="item-meta">No arguments — invoke directly.</p>
    ) : (
      selectedPrompt.arguments.map((arg) =>
        renderArgField(
          arg,
          argValues[arg.name] ?? '',
          (val) => handleArgChange(arg.name, val)
        )
      )
    )}
    <button
      type="submit"
      className="submit-btn"
      disabled={invokeState.status === 'loading'}
    >
      {invokeState.status === 'loading' && <span className="spinner" />}
      {invokeState.status === 'loading' ? 'Invoking…' : `Invoke ${selectedPrompt.name}`}
    </button>
  </form>
)}
```

### CSS — Complete Reuse, No New Classes

All needed CSS classes already exist in `index.css`:

| Need | Existing class |
|------|----------------|
| Argument form container | `.tool-form` |
| Each field wrapper | `.tool-form-field` |
| Field label style | `.tool-form-field label` |
| Text input style | `.tool-form-field input` |
| Optional field label | `.field-optional` |
| Invoke button | `.submit-btn` |
| Loading/disabled button | `.submit-btn:disabled` |
| Result container | `.call-result` |
| Text result pre | `.tool-text-result` |
| Error display | `.panel .error` |
| Post-action line | `.post-action` |
| Selected card highlight | `.item-card--selected` |
| Loading state | `.loading` + `.spinner` |

**DO NOT add any new CSS classes.** All styles are already available.

### Validation Error Handling

Add `argErrors: Record<string, string>` state alongside `argValues`:
- Set errors in `handleInvoke` when required args are empty
- Clear individual error when `handleArgChange` is called for that field
- Render per-field error with `<span className="field-error">{argErrors[arg.name]}</span>`
- Apply `input-invalid` class to the input when `argErrors[arg.name]` exists

### State Reset on Prompt Switch

When the user clicks a different prompt card, reset ALL state:

```typescript
function handleSelect(prompt: Prompt) {
  setSelectedPrompt(prompt);
  setArgValues({});
  setArgErrors({});
  setInvokeState({ status: 'idle' });
}
```

### Anti-Patterns to Avoid

1. **Do NOT add `getPrompt` to McpContext** — prompt invocation is local action state in PromptsPanel (architecture: "local state for forms and selection")
2. **Do NOT use `getInputType()` from ToolsPanel** — prompt arguments have no enum or type info; all fields are text inputs; no need to import or share that function
3. **Do NOT reset form on error** — AC6: "the argument form remains filled for correction"; only reset `invokeState` to idle so user can retry
4. **Do NOT include empty string args** — filter them out before calling `getPrompt`; sending `{ from: "" }` is semantically wrong (the server ignores undefined args, but empty strings may cause filtering issues)
5. **Do NOT render a new `<form>` outside the panel** — keep the form inside the `<section className="panel">` element; no routing changes
6. **Do NOT import `TASK_COLUMN_DEFS` or `DEFAULT_COL_DEF` directly** — pass `rows` to `<TaskGrid>` which handles column defs internally
7. **Do NOT assume `prompt.arguments` is always an array** — check `!prompt.arguments || prompt.arguments.length === 0` before mapping
8. **Do NOT show AG Grid for non-task tables** — use the `hasTaskData` check (rows with non-empty `id` or `title`); otherwise `tasks_summary_for_stakeholders` status-count table would render as an empty-looking grid
9. **Do NOT use `argumentsSummary()` helper inside the form** — keep it for the item-card meta line only; the form renders individual fields via `renderArgField`

### Previous Story Intelligence (from Story 4.3, done 2026-03-20)

- `sendJsonRpc`, `ensureInitialized`, `listResources`, `listTools`, `listPrompts`, `readResource`, `ToolCallResult`, `callTool` all exist in `client/src/mcp/client.ts` — extend with `getPrompt`, `PromptMessage`, `PromptResult` only
- `MCP_COPY` const in `mcpExplainer.ts` has `postActionInvoke(promptName)` already — use it; just add `gridNotePrompt`
- CSS variables available: `--accent`, `--accent-light`, `--border`, `--bg`, `--error`, `--error-bg`, `--error-border`, `--text`, `--text-h`, `--mono`, `--success`, `--code-bg`
- `.spinner` CSS keyframe + `.panel .error` + `.item-card--selected` + `.post-action` + `.tool-form` + `.tool-form-field` + `.submit-btn` + `.call-result` + `.tool-text-result` + `.field-error` + `.field-optional` + `.input-invalid` all exist — reuse all of them
- `parseMarkdownTable(text): GridRow[]` exists in `client/src/lib/parseMarkdownTable.ts` — import and use for prompt result parsing
- `TaskGrid` component accepts `{ rows: GridRow[], note?: string, postAction?: string }` — reuse directly
- ToolsPanel uses `submitSeqRef` to handle rapid successive submits — PromptsPanel can use the same pattern for safety
- ESLint requires: no unused vars; avoid anonymous inline async in event handlers; define named functions

### Git Intelligence (from Story 4.3 commit: `46a8607`)

Files created/modified by Story 4.3:
- **Modified:** `client/src/mcp/client.ts`, `client/src/copy/mcpExplainer.ts`, `client/src/components/ToolsPanel.tsx`, `client/src/index.css`

These files are all stable and ready to extend for this story.

### Files Created / Modified This Story

**No new files** — all changes extend existing files.

**Modified files:**
- `client/src/mcp/client.ts` (add `getPrompt`, `PromptMessage`, `PromptResult`)
- `client/src/copy/mcpExplainer.ts` (add `gridNotePrompt`)
- `client/src/components/PromptsPanel.tsx` (full rewrite: select prompt, argument form, invoke state, result display)

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server)
- `proxy/` (proxy unchanged)
- `package.json` (root)
- `client/src/lib/parseMarkdownTable.ts`
- `client/src/lib/taskColumns.ts`
- `client/src/components/TaskGrid.tsx`
- `client/src/components/ResourcesPanel.tsx`
- `client/src/components/ToolsPanel.tsx`
- `client/src/context/McpContext.tsx`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/index.css`

### Tech Stack Reference

| Item | Value |
|------|-------|
| AG Grid | Community v35.1.0 (`ag-grid-react`, `ag-grid-community`) |
| AG Grid Theme | `ag-theme-quartz` (CSS imported in `TaskGrid.tsx`) |
| React | 19.2.4 + TypeScript ~5.9.3 |
| Vite | 8.0.1 (dev server on 5173) |
| State management | local `useState` in PromptsPanel (not context) |
| CSS | Plain CSS in `index.css` (no Tailwind) |
| Form | Controlled inputs with `useState` (no form library) |

### Verification Steps

1. **Proxy running:** `cd proxy && npm run dev` → `MCP proxy listening on http://localhost:3001`
2. **Client running:** `cd client && npm run dev` → Vite on `localhost:5173`
3. **Click `tasks_table`** → form renders with `sort` text input
4. **`sort` placeholder** → shows description "Sort order: 'deadline' | 'priority' | 'priority-then-deadline'"
5. **Submit without sort** → required field error; form not submitted
6. **Enter `deadline` → Invoke** → button disables with spinner; task table appears in AG Grid with "This content came from a Prompt — shown here in the grid."
7. **Post-action line** → "You invoked the tasks_table prompt — this content came from a Prompt."
8. **Click `tasks_summary_for_stakeholders`** → form shows "No arguments — invoke directly."; Invoke button visible
9. **Click Invoke** → summary text appears in `<pre>` (Status/Count table + overdue section if any)
10. **Click `completions_by_date`** → form shows `from` + `to` optional text inputs
11. **Invoke with empty args** → all completed tasks shown (or "No completed tasks found.")
12. **Invoke `tasks_table` with invalid sort** → inline error; form still filled
13. **Stop proxy → Invoke** → "Proxy unreachable" error inline; form still filled
14. **Click different prompt while result showing** → form/result clear immediately
15. **`cd client && npm run build`** → zero TypeScript errors
16. **`cd client && npm run lint`** → zero ESLint errors
17. **ResourcesPanel, ToolsPanel unchanged** — regression check

## Definition of Done

- [ ] `client/src/mcp/client.ts` exports `getPrompt`, `PromptMessage`, `PromptResult`
- [ ] `client/src/copy/mcpExplainer.ts` has `gridNotePrompt` key
- [ ] Prompt cards are clickable; selected card highlighted with `item-card--selected`
- [ ] Argument form renders fields from `prompt.arguments` with text inputs + required validation
- [ ] Prompts with no arguments show "No arguments" message; Invoke button still present
- [ ] Required argument validation prevents empty submit and shows per-field error
- [ ] Invoke calls `prompts/get`; button shows loading/disabled during in-flight
- [ ] Tabular prompt result (task table) shown in `TaskGrid` with `gridNotePrompt` note and `postActionInvoke` line
- [ ] Non-tabular result (summary, completions) shown as pre-formatted text with `postActionInvoke` line
- [ ] MCP error shown inline; argument form remains filled
- [ ] Switching prompts resets arg values, errors, and invoke state
- [ ] No changes to server, proxy, McpContext, ResourcesPanel, ToolsPanel, App.tsx, TaskGrid, parseMarkdownTable, taskColumns, index.css
- [ ] `npm run build` in `client/` — zero TypeScript errors
- [ ] `npm run lint` in `client/` — zero ESLint errors

## Dev Agent Record

### Implementation Plan

Extended `client/src/mcp/client.ts` with `PromptMessage`, `PromptResult` interfaces and a `getPrompt` function following the same `ensureInitialized` + `sendJsonRpc` + response-shape validation pattern used by `callTool`. Added `gridNotePrompt` copy key to `mcpExplainer.ts`. Rewrote `PromptsPanel.tsx` to mirror the ToolsPanel interaction pattern: clickable item-cards set `selectedPrompt`, a controlled argument form renders text inputs from `prompt.arguments`, `handleInvoke` validates required fields, calls `getPrompt`, then routes the result — AG Grid for task-row data (checked via `hasTaskData`), or `<pre>` for summary/completions text. Used `submitSeqRef` for stale-response protection on rapid re-invocations. All CSS classes reused from existing `index.css`.

### Completion Notes

- `client/src/mcp/client.ts`: Added `PromptMessage`, `PromptResult` interfaces and `getPrompt` async function
- `client/src/copy/mcpExplainer.ts`: Added `gridNotePrompt` key: "This content came from a Prompt — shown here in the grid."
- `client/src/components/PromptsPanel.tsx`: Full rewrite — prompt card selection with `item-card--selected`, `argErrors` state for per-field validation, `argValues` reset on prompt switch, `invokeState` machine (idle/loading/error/success), `hasTaskData` check routes to TaskGrid vs. pre-formatted text, `submitSeqRef` prevents stale state
- `npm run build` → zero TypeScript errors ✓
- `npm run lint` → zero ESLint errors ✓
- No changes to server, proxy, McpContext, ResourcesPanel, ToolsPanel, App.tsx, TaskGrid, parseMarkdownTable, taskColumns, index.css ✓

## File List

- `client/src/mcp/client.ts` — add `PromptMessage`, `PromptResult` interfaces and `getPrompt` function
- `client/src/copy/mcpExplainer.ts` — add `gridNotePrompt`
- `client/src/components/PromptsPanel.tsx` — full rewrite with argument form, invoke state, result display

## Change Log

- 2026-03-20: Story 4.4 created — ready for dev
- 2026-03-20: Story 4.4 implemented — status set to review
- 2026-03-20: Code review complete — patched AC4 (pre+grid additive for mixed-content prompts); deferred TD-26, TD-27 to tech-debt.md; status set to done
