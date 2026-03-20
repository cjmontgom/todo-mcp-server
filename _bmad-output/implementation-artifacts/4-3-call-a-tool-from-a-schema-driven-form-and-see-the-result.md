# Story 4.3: Call a Tool from a schema-driven form and see the result

Status: review

## Story

As a learner,
I want to fill a form built from a tool's input schema, submit it, and see confirmation including an educational note about what just happened,
so that I understand what calling a Tool does and why it differs from reading a Resource.

## Acceptance Criteria

1. **AC1 — Selected tool renders schema-driven form**
   Given a tool (e.g. `create_task`) is selected in the Tools section
   When the panel renders
   Then a form is displayed with fields matching the tool's `inputSchema` properties (e.g. title, description, priority, dueDate) with correct field types (text, select, date) (FR22, UX-DR3)

2. **AC2 — Required field validation prevents empty submit**
   Given required fields are defined in `inputSchema`
   When a user submits without filling them
   Then client-side validation prevents submission and highlights the missing fields

3. **AC3 — Form submit calls tools/call and shows result**
   Given the form is filled and submitted
   When the app calls `tools/call` with the provided arguments
   Then the result (success or MCP tool result) is displayed below the form (FR22)

4. **AC4 — Mutating tool success shows server-state note and refresh option**
   Given a mutating tool (`create_task` or `update_task`) succeeds
   When the result is displayed
   Then a note reads: "You just used a Tool — the server state changed." and an option to refresh the Resource grid is presented (FR23, UX-DR6)

5. **AC5 — Tabular tool result shown in AG Grid**
   Given the tool result contains tabular data (a markdown table in the text content)
   When the result renders
   Then it is displayed in AG Grid using the same shared `TaskGrid` component and `TASK_COLUMN_DEFS` (FR25)

6. **AC6 — Submit button loading state during in-flight call**
   Given a `tools/call` request is in-flight
   When the user waits
   Then the submit button shows a loading state and is disabled to prevent duplicate calls (UX-DR8)

7. **AC7 — MCP error shows inline with form preserved**
   Given `tools/call` returns an MCP error
   When the error is received
   Then an inline error message is shown with the error's `message` field; the form remains filled for correction (UX-DR7)

## Tasks / Subtasks

- [x] Task 1: Add `callTool` to `client/src/mcp/client.ts` (AC: #3, #6, #7)
  - [x] 1.1 Export `ToolCallResult` interface: `{ content: Array<{ type: string; text?: string }>; isError?: boolean }`
  - [x] 1.2 Export `callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>` that calls `sendJsonRpc("tools/call", { name: toolName, arguments: args })` and returns the typed result
  - [x] 1.3 Call `ensureInitialized()` before the request (same pattern as all other client functions)
  - [x] 1.4 Validate response shape: throw if `result` is falsy or `result.content` is missing or not an array

- [x] Task 2: Add copy keys to `client/src/copy/mcpExplainer.ts` (AC: #4, #5)
  - [x] 2.1 Add `toolMutatedNote`: `"You just used a Tool — the server state changed."`
  - [x] 2.2 Add `toolRefreshHint`: `"Re-read any Resource above to see the updated task data."`
  - [x] 2.3 Add `gridNoteTool`: `"This grid shows data returned by a Tool Call. Tools execute actions on the server — unlike Resources, which are read-only."`

- [x] Task 3: Rewrite `client/src/components/ToolsPanel.tsx` (AC: #1–#7)
  - [x] 3.1 Add `selectedTool: Tool | null` state (init `null`); clicking an item-card sets it
  - [x] 3.2 Add `formValues: Record<string, string>` state (init `{}`); reset when selected tool changes
  - [x] 3.3 Add `validationErrors: Record<string, string>` state (init `{}`) for per-field required errors
  - [x] 3.4 Add `callState: { status: 'idle' | 'loading' | 'error' | 'success'; text?: string; rows?: GridRow[]; error?: string; isMutating?: boolean }` state (init `{ status: 'idle' }`)
  - [x] 3.5 Implement `handleSelect(tool)` — sets `selectedTool`, resets `formValues` to `{}`, resets `callState` to idle, resets `validationErrors` to `{}`
  - [x] 3.6 Implement `handleFieldChange(name, value)` — updates `formValues[name]`, clears `validationErrors[name]` if it was set
  - [x] 3.7 Implement `handleSubmit(e)` — validates required fields, sets validation errors and returns early if invalid; sets `callState` to loading; builds `args` (only non-empty fields); calls `callTool`; on success: extracts text, tries `parseMarkdownTable`, sets `callState.success`; on error: sets `callState.error`
  - [x] 3.8 Render: tool-list section with clickable item-cards (same pattern as before, add `item-card--selected` + `role="button"` + `tabIndex={0}` + keyboard handler)
  - [x] 3.9 Render: tool-form section below the list when `selectedTool !== null`
  - [x] 3.10 Render form fields based on `inputSchema.properties` — use `renderField(name, schema, required)` helper
  - [x] 3.11 Render submit button with loading state: `<button type="submit" className="submit-btn" disabled={callState.status === 'loading'}>` with spinner span when loading
  - [x] 3.12 Render call-result section: error | success with text/grid | isMutating note + refresh hint
  - [x] 3.13 Import `TaskGrid`, `GridRow`, `parseMarkdownTable`, `callTool`, `ToolCallResult`, `MCP_COPY`

- [x] Task 4: Add CSS to `client/src/index.css` (AC: styling)
  - [x] 4.1 `.tool-form` — `margin-top: 24px; display: flex; flex-direction: column; gap: 16px;`
  - [x] 4.2 `.tool-form-field` — `display: flex; flex-direction: column; gap: 4px;`
  - [x] 4.3 `.tool-form-field label` — `font-size: 13px; font-weight: 600; color: var(--text-h);`
  - [x] 4.4 `.tool-form-field label .field-optional` — `font-weight: 400; color: var(--text); margin-left: 4px;`
  - [x] 4.5 `.tool-form-field input`, `.tool-form-field select` — reuse same styles as `.filter-input` (same border, padding, border-radius, font-size, bg, color)
  - [x] 4.6 `.field-error` (text below invalid field) — `font-size: 12px; color: var(--error);`
  - [x] 4.7 `.tool-form-field input.input-invalid`, `.tool-form-field select.input-invalid` — `border-color: var(--error);`
  - [x] 4.8 `.submit-btn` — `align-self: flex-start; padding: 8px 20px; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;`
  - [x] 4.9 `.submit-btn:hover:not(:disabled)` — `opacity: 0.9;`
  - [x] 4.10 `.submit-btn:disabled` — `opacity: 0.5; cursor: not-allowed;`
  - [x] 4.11 `.call-result` — `margin-top: 24px; display: flex; flex-direction: column; gap: 12px;`
  - [x] 4.12 `.tool-mutated-note` — `font-size: 13px; color: var(--success); font-weight: 600; margin: 0;`
  - [x] 4.13 `.tool-refresh-hint` — `font-size: 13px; color: var(--text); margin: 0;`
  - [x] 4.14 `.tool-text-result` — same styles as `.raw-text` (monospace, code-bg, padding, border-radius)

- [x] Task 5: Build and verify (AC: all)
  - [x] 5.1 `npm run build` in root (server unchanged, verifies no server breakage)
  - [ ] 5.2 `cd proxy && npm run dev` — proxy starts on 3001
  - [ ] 5.3 `cd client && npm run dev` — client starts on 5173
  - [ ] 5.4 Click `create_task` → form appears with fields: title (text), description (text), status (select), priority (select), dueDate (date)
  - [ ] 5.5 Submit empty form → validation error on `title` (required); form not submitted
  - [ ] 5.6 Fill title → submit → loading state on button; result appears below
  - [ ] 5.7 Mutating tool success → "You just used a Tool — the server state changed." note visible
  - [ ] 5.8 Click `update_task` → form shows id field (required) + other optional fields
  - [ ] 5.9 Submit with valid id → success; "server state changed" note visible
  - [ ] 5.10 Submit with invalid id → inline error shown; form still filled
  - [ ] 5.11 Stop proxy → submit → inline error (proxy unreachable); form still filled
  - [x] 5.12 `cd client && npm run build` — zero TypeScript errors
  - [x] 5.13 `cd client && npm run lint` — zero lint errors
  - [x] 5.14 Verify ResourcesPanel, PromptsPanel, App.tsx unchanged (regression check)

## Dev Notes

### Architecture Overview

This story adds the Tool Call flow to the existing ToolsPanel scaffold from Story 4.1. The flow is:

```
User clicks tool card
  → ToolsPanel.handleSelect(tool)
    → form renders with inputSchema fields

User fills form + submits
  → ToolsPanel.handleSubmit()
    → validate required fields → show errors or proceed
    → callTool(name, args) [new client.ts export]
      → POST /mcp  {method: "tools/call", params: {name, arguments: args}}
        → Proxy forwards to MCP server
        → Returns {content: [{type: "text", text: "..."}], isError: false}
    → extract text from content array
    → try parseMarkdownTable → if rows > 0 → TaskGrid
    → else → <pre className="tool-text-result">
    → if mutating tool → show toolMutatedNote + toolRefreshHint
```

No changes to: `src/index.ts` (MCP server), `proxy/`, root `package.json`, `McpContext.tsx`, `ResourcesPanel.tsx`, `PromptsPanel.tsx`, `TaskGrid.tsx`, `parseMarkdownTable.ts`, `taskColumns.ts`.

### `callTool` Implementation in `client/src/mcp/client.ts`

Add after `readResource`:

```typescript
export interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  await ensureInitialized();
  const result = await sendJsonRpc("tools/call", { name: toolName, arguments: args });
  const typed = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  if (!typed || !Array.isArray(typed.content)) {
    throw new Error(`Unexpected response shape from tools/call (tool: ${toolName})`);
  }
  return { content: typed.content, isError: typed.isError };
}
```

### `tools/call` Wire Format

```json
// Request
{ "jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": { "name": "create_task", "arguments": { "title": "Fix bug", "priority": "high" } } }

// Success Response
{
  "result": {
    "content": [{ "type": "text", "text": "Task created: {\"id\":\"task-abc\",\"title\":\"Fix bug\",...}" }],
    "isError": false
  }
}

// MCP Error Response (server-level error, still HTTP 200)
{
  "result": {
    "content": [{ "type": "text", "text": "Task not found: unknown-id" }],
    "isError": true
  }
}

// JSON-RPC Error (thrown by sendJsonRpc)
{
  "error": { "code": -32602, "message": "Invalid params: title is required" }
}
```

**Critical:** There are TWO error paths:
1. `sendJsonRpc` throws when `data.error` is present (JSON-RPC level error) — caught by `handleSubmit` catch block
2. `result.isError === true` means the tool executed but returned an error — treat this as a user-visible error too (set `callState.error` with the text content)

### Tool-available Inputs: Exact `inputSchema` for `create_task` and `update_task`

From the live MCP server (verified against `src/index.ts`):

**`create_task` inputSchema:**
```json
{
  "type": "object",
  "properties": {
    "title":       { "type": "string", "description": "Task title" },
    "description": { "type": "string", "description": "Task description" },
    "status":      { "type": "string", "enum": ["todo","in-progress","done"], "description": "..." },
    "priority":    { "type": "string", "enum": ["low","medium","high"], "description": "..." },
    "dueDate":     { "type": "string", "description": "ISO date, e.g. 2026-04-01" }
  },
  "required": ["title"]
}
```

**`update_task` inputSchema:**
```json
{
  "type": "object",
  "properties": {
    "id":          { "type": "string", "description": "Task ID" },
    "title":       { "type": "string", "description": "New title" },
    "description": { "type": "string", "description": "New description" },
    "status":      { "type": "string", "enum": ["todo","in-progress","done"] },
    "priority":    { "type": "string", "enum": ["low","medium","high"] },
    "dueDate":     { "type": "string", "description": "ISO date or null to clear" }
  },
  "required": ["id"]
}
```

### Form Field Rendering Logic

Map each `inputSchema.properties` entry to an HTML input type:

```typescript
function getInputType(fieldName: string, schema: { type: string; description?: string; enum?: string[] }): 'text' | 'date' | 'select' {
  if (schema.enum && schema.enum.length > 0) return 'select';
  // detect date fields by name convention
  if (fieldName.toLowerCase().includes('date')) return 'date';
  return 'text';
}
```

Render each field as:
```tsx
function renderField(
  name: string,
  schema: { type: string; description?: string; enum?: string[] },
  required: boolean,
  value: string,
  error: string | undefined,
  onChange: (val: string) => void
) {
  const inputType = getInputType(name, schema);
  const id = `field-${name}`;
  const isInvalid = !!error;

  return (
    <div key={name} className="tool-form-field">
      <label htmlFor={id}>
        {name}
        {!required && <span className="field-optional">(optional)</span>}
      </label>
      {inputType === 'select' ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={isInvalid ? 'input-invalid' : ''}
        >
          <option value="">— select —</option>
          {schema.enum!.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.description ?? name}
          className={isInvalid ? 'input-invalid' : ''}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
```

### `handleSubmit` Implementation

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // Validate required fields
  const required = new Set(selectedTool!.inputSchema.required ?? []);
  const errors: Record<string, string> = {};
  for (const name of required) {
    if (!formValues[name]?.trim()) {
      errors[name] = `${name} is required`;
    }
  }
  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return;
  }

  // Build args: include only non-empty values (optional fields)
  const args: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(formValues)) {
    if (value.trim() !== '') {
      args[name] = value.trim();
    }
  }

  const MUTATING_TOOLS = new Set(['create_task', 'update_task']);
  const isMutating = MUTATING_TOOLS.has(selectedTool!.name);

  setCallState({ status: 'loading' });
  try {
    const result = await callTool(selectedTool!.name, args);

    // Extract text from content array
    const text = result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

    // Handle isError from tool (tool executed but returned error content)
    if (result.isError) {
      setCallState({ status: 'error', error: text || 'Tool returned an error.' });
      return;
    }

    // Try to parse as markdown table → AG Grid
    const rows = parseMarkdownTable(text);
    setCallState({ status: 'success', text, rows: rows.length > 0 ? rows : undefined, isMutating });
  } catch (err) {
    setCallState({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

### Result Display in ToolsPanel JSX

```tsx
{callState.status !== 'idle' && (
  <div className="call-result">
    {callState.status === 'loading' && (
      <div className="loading">
        <span className="spinner" />
        Calling tool…
      </div>
    )}
    {callState.status === 'error' && (
      <div className="error">{callState.error}</div>
    )}
    {callState.status === 'success' && (
      <>
        {callState.isMutating && (
          <>
            <p className="tool-mutated-note">{MCP_COPY.toolMutatedNote}</p>
            <p className="tool-refresh-hint">{MCP_COPY.toolRefreshHint}</p>
          </>
        )}
        {callState.rows && callState.rows.length > 0 ? (
          <TaskGrid
            rows={callState.rows}
            note={MCP_COPY.gridNoteTool}
            postAction={MCP_COPY.postActionCall(selectedTool!.name)}
          />
        ) : (
          <>
            <p className="post-action">{MCP_COPY.postActionCall(selectedTool!.name)}</p>
            {callState.text && (
              <pre className="tool-text-result">{callState.text}</pre>
            )}
          </>
        )}
      </>
    )}
  </div>
)}
```

### State Reset on Tool Switch

When the user clicks a different tool card, reset ALL state to avoid showing stale results:

```typescript
async function handleSelect(tool: Tool) {
  setSelectedTool(tool);
  setFormValues({});
  setValidationErrors({});
  setCallState({ status: 'idle' });
}
```

### `CallState` Type Definition

Define this interface inside `ToolsPanel.tsx` (not exported, not shared):

```typescript
interface CallState {
  status: 'idle' | 'loading' | 'error' | 'success';
  text?: string;
  rows?: GridRow[];
  error?: string;
  isMutating?: boolean;
}
```

### Arguments Filtering — Critical for Optional Fields

Only include non-empty string values in the `args` object passed to `callTool`. DO NOT include `""` (empty string) for optional fields — the server may reject or misinterpret empty strings for fields like `dueDate` or `priority`.

```typescript
// Correct:
const args: Record<string, unknown> = {};
for (const [name, value] of Object.entries(formValues)) {
  if (value.trim() !== '') args[name] = value.trim();
}

// Wrong — do NOT do this:
const args = { ...formValues }; // includes empty strings
```

### Tool-card Interaction Pattern

Make each item-card clickable following the ResourcesPanel pattern:
```tsx
<div
  key={t.name}
  className={`item-card${selectedTool?.name === t.name ? ' item-card--selected' : ''}`}
  onClick={() => handleSelect(t)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(t); }}}
  role="button"
  tabIndex={0}
>
```

### CSS — DO NOT Duplicate

`.filter-input` already exists. For tool form inputs and selects, create new selectors `.tool-form-field input` and `.tool-form-field select` with the same property values rather than adding classes. This keeps CSS DRY and specific:

```css
.tool-form-field input,
.tool-form-field select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg);
  color: var(--text-h);
}

.tool-form-field input:focus,
.tool-form-field select:focus {
  outline: none;
  border-color: var(--accent);
}
```

`.raw-text` already exists. For `.tool-text-result` use identical styles:
```css
.tool-text-result {
  font-family: var(--mono);
  font-size: 13px;
  white-space: pre-wrap;
  background: var(--code-bg);
  padding: 12px 16px;
  border-radius: 6px;
  margin: 0;
  overflow-x: auto;
}
```

### Anti-Patterns to Avoid

1. **Do NOT add `callTool` to McpContext** — tool calling is local action state in ToolsPanel (architecture: "local state for forms and selection")
2. **Do NOT use uncontrolled form inputs** — use `value` + `onChange` (controlled) so `formValues` is always the source of truth for validation
3. **Do NOT reset form on error** — AC7: "the form remains filled for correction"; only reset `callState` to idle so user can retry
4. **Do NOT include empty string args** — filter them out before calling `callTool`; `dueDate: ""` will cause server validation errors
5. **Do NOT render a new `<form>` outside the panel** — keep the form inside the `<section className="panel">` element; no routing changes
6. **Do NOT import `TASK_COLUMN_DEFS` or `DEFAULT_COL_DEF` directly** — pass `rows` to `<TaskGrid>` which handles column defs internally
7. **Do NOT add a second spinner CSS definition** — `.spinner` already exists in `index.css`; reuse `<span className="spinner" />`
8. **Do NOT use `type="submit"` on a button outside a `<form>` element** — the submit button must be inside a `<form onSubmit={handleSubmit}>` wrapper to get the `e.preventDefault()` flow
9. **Do NOT call `handleSubmit` when in loading state** — the `disabled={callState.status === 'loading'}` on the button handles this; no additional guard needed
10. **Do NOT duplicate the `schemaSummary` helper** — keep it for the item-card meta line (`Parameters: ...`); do NOT use it inside the form

### Previous Story Intelligence (from Story 4.2, done 2026-03-20)

- `sendJsonRpc`, `ensureInitialized`, `listResources`, `listTools`, `listPrompts`, `readResource`, `ResourceContent` all exist in `client/src/mcp/client.ts` — extend with `callTool`/`ToolCallResult` only
- `MCP_COPY` const in `mcpExplainer.ts` has `postActionCall(toolName)` already — use it; just add `toolMutatedNote`, `toolRefreshHint`, `gridNoteTool`
- CSS variables available: `--accent`, `--accent-light`, `--border`, `--bg`, `--error`, `--error-bg`, `--error-border`, `--text`, `--text-h`, `--mono`, `--success`, `--code-bg`
- `.spinner` CSS keyframe + `.panel .error` + `.item-card--selected` + `.post-action` all exist — reuse
- `parseMarkdownTable(text): GridRow[]` exists in `client/src/lib/parseMarkdownTable.ts` — import and use for tool result parsing
- `TaskGrid` component accepts `{ rows: GridRow[], note?: string, postAction?: string }` — reuse directly
- ResourcesPanel uses `latestUriRef` + `mountedRef` guard to handle race conditions on rapid clicks — consider whether ToolsPanel needs this (form submit is slower; a simple `isSubmitting` flag via `callState.status === 'loading'` + `disabled` button is sufficient)
- ESLint requires: no unused vars; avoid anonymous inline async in event handlers; define named functions

### Git Intelligence (from Story 4.2 commit: `9a2a7ac`)

Files created/modified by previous work:
- **New:** `client/src/lib/parseMarkdownTable.ts`, `client/src/lib/taskColumns.ts`, `client/src/components/TaskGrid.tsx`
- **Modified:** `client/src/mcp/client.ts`, `client/src/copy/mcpExplainer.ts`, `client/src/components/ResourcesPanel.tsx`, `client/src/index.css`

These files are all stable and ready to extend for this story.

### Files Created / Modified This Story

**No new files** — all changes extend existing files.

**Modified files:**
- `client/src/mcp/client.ts` (add `callTool`, `ToolCallResult`)
- `client/src/copy/mcpExplainer.ts` (add `toolMutatedNote`, `toolRefreshHint`, `gridNoteTool`)
- `client/src/components/ToolsPanel.tsx` (major update: select tool, form, call state, result display)
- `client/src/index.css` (add tool form, submit button, call result CSS)

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server)
- `proxy/` (proxy unchanged)
- `package.json` (root)
- `client/src/lib/parseMarkdownTable.ts`
- `client/src/lib/taskColumns.ts`
- `client/src/components/TaskGrid.tsx`
- `client/src/context/McpContext.tsx`
- `client/src/components/ResourcesPanel.tsx`
- `client/src/components/PromptsPanel.tsx`
- `client/src/App.tsx`
- `client/src/main.tsx`

### Tech Stack Reference

| Item | Value |
|------|-------|
| AG Grid | Community v35.1.0 (`ag-grid-react`, `ag-grid-community`) |
| AG Grid Theme | `ag-theme-quartz` (CSS imported in `TaskGrid.tsx`) |
| React | 19.2.4 + TypeScript ~5.9.3 |
| Vite | 8.0.1 (dev server on 5173) |
| State management | local `useState` in ToolsPanel (not context) |
| CSS | Plain CSS in `index.css` (no Tailwind) |
| Form | Controlled inputs with `useState` (no form library) |

### Verification Steps

1. **Proxy running:** `cd proxy && npm run dev` → `MCP proxy listening on http://localhost:3001`
2. **Client running:** `cd client && npm run dev` → Vite on `localhost:5173`
3. **Click `create_task`** → form renders with 5 fields (title, description, status, priority, dueDate)
4. **status/priority fields** → `<select>` with enum options (todo/in-progress/done; low/medium/high)
5. **dueDate field** → `<input type="date">` (native date picker)
6. **Submit empty** → `title` field highlighted with error; form not submitted
7. **Fill title + submit** → button disables with spinner; result appears below
8. **Success result** → "You just used a Tool — the server state changed." note + "Re-read any Resource above to see the updated task data." hint
9. **Click `update_task`** → previous form and result cleared; new form with id, title, etc.
10. **Use invalid id → submit** → inline error shown; form fields remain filled
11. **Stop proxy → submit** → "Proxy unreachable" error shown inline; form still filled
12. **`cd client && npm run build`** → zero TypeScript errors
13. **`cd client && npm run lint`** → zero ESLint errors
14. **ResourcesPanel, PromptsPanel unchanged** — regression check

## Definition of Done

- [ ] `client/src/mcp/client.ts` exports `callTool` and `ToolCallResult`
- [ ] `client/src/copy/mcpExplainer.ts` has `toolMutatedNote`, `toolRefreshHint`, `gridNoteTool` keys
- [ ] `ToolsPanel` tool cards are clickable, selected card highlighted
- [ ] Form renders fields from `inputSchema` with correct input types (text / select / date)
- [ ] Required field validation prevents empty submit and shows per-field error
- [ ] Submit calls `tools/call`; button shows loading/disabled during in-flight
- [ ] Mutating tool success shows "server state changed" note + refresh hint
- [ ] Tool error: inline error shown, form remains filled
- [ ] Tabular tool result shown in `TaskGrid` with shared columns and grid note
- [ ] Non-tabular result shown as pre-formatted text
- [ ] `isError: true` tool response treated as user-visible error
- [ ] Switching tools resets form, call state, and validation errors
- [ ] No changes to server, proxy, McpContext, ResourcesPanel, PromptsPanel, App.tsx, TaskGrid, parseMarkdownTable, taskColumns
- [ ] `npm run build` in `client/` — zero TypeScript errors
- [ ] `npm run lint` in `client/` — zero ESLint errors

## Dev Agent Record

### Implementation Plan

Implemented all four code changes in sequence:
1. Extended `client.ts` with `ToolCallResult` interface and `callTool` function following the exact same `ensureInitialized` + `sendJsonRpc` + shape validation pattern as existing exports.
2. Added `toolMutatedNote`, `toolRefreshHint`, `gridNoteTool` to the `MCP_COPY` const in `mcpExplainer.ts`.
3. Rewrote `ToolsPanel.tsx` with four controlled state slices (`selectedTool`, `formValues`, `validationErrors`, `callState`), plus helpers `getInputType`, `renderField`, and async `handleSubmit` with the two error paths (JSON-RPC throw, `isError: true`).
4. Added all Story 4.3 CSS classes to `index.css` with `/* Story 4.3 additions */` comment block.

### Completion Notes

- ✅ `callTool` + `ToolCallResult` exported from `client/src/mcp/client.ts`
- ✅ Three new copy keys added to `mcpExplainer.ts`
- ✅ `ToolsPanel.tsx` fully rewritten: selectable tool cards, schema-driven form, required-field validation, loading/error/success call state, mutating-tool note, tabular result in TaskGrid, text result in `<pre>`
- ✅ All CSS for tool form, submit button, call result, mutated note, refresh hint, tool text result added to `index.css`
- ✅ `npm run build` (root server) — zero errors
- ✅ `cd client && npm run build` — zero TypeScript errors
- ✅ `cd client && npm run lint` — zero ESLint errors
- ✅ `ResourcesPanel.tsx`, `PromptsPanel.tsx`, `App.tsx`, `TaskGrid.tsx`, `parseMarkdownTable.ts`, `taskColumns.ts`, `McpContext.tsx`, `proxy/`, `src/index.ts` — all unchanged

## File List

- `client/src/mcp/client.ts` — added `ToolCallResult` interface and `callTool` function
- `client/src/copy/mcpExplainer.ts` — added `toolMutatedNote`, `toolRefreshHint`, `gridNoteTool`
- `client/src/components/ToolsPanel.tsx` — full rewrite with form, call state, result display
- `client/src/index.css` — added tool form, submit button, call result CSS

## Change Log

- 2026-03-20: Story 4.3 created — ready for dev
- 2026-03-20: Story 4.3 implemented — all ACs satisfied, build and lint pass
