# Story 4.2: Read a Resource and display tabular results in AG Grid

Status: review

## Story

As a learner,
I want to click a resource, read it from the server, and see tabular data in AG Grid,
so that I learn what a Resource Read looks like and practise AG Grid.

## Acceptance Criteria

1. **AC1 — Click resource → resources/read called**
   Given the Resources section is populated
   When a user clicks a resource URI (e.g. `task://table/by-deadline`)
   Then the app calls `resources/read` with that URI and displays the response

2. **AC2 — Markdown resource rendered in AG Grid**
   Given the resource response is `text/markdown` with a markdown table
   When the result is displayed
   Then the app parses the markdown into row objects and renders them in AG Grid with columns: ID, Title, Priority, Due, Status (FR20, FR21, UX-DR2)

3. **AC3 — JSON resource rendered in AG Grid**
   Given the resource response is `application/json` containing a task array (e.g. `task://all`)
   When the result is displayed
   Then the app maps the JSON array to row objects and renders them in AG Grid with the same column set (FR21)

4. **AC4 — Client-side sorting**
   Given the grid is rendered
   When a user clicks a column header
   Then the grid sorts by that column client-side (FR25)

5. **AC5 — Client-side filtering**
   Given the grid is rendered
   When a user types in a filter input
   Then the grid filters rows client-side (FR25)

6. **AC6 — Grid educational note**
   Given the grid is rendered with data
   When the user sees the grid
   Then a short note is visible near the grid: "This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP." (FR26, UX-DR5)

7. **AC7 — Switch resources without page reload**
   Given the user switches from one resource to another (e.g. from `task://table/all` to `task://table/by-priority`)
   When the new resource is read
   Then the grid updates to show the new data set without a page reload (FR25)

8. **AC8 — Read failure shows error, no stale data**
   Given a `resources/read` call fails (e.g. proxy error)
   When the error is received
   Then an inline error is shown and the grid shows no stale data from the previous read (UX-DR7)

## Tasks / Subtasks

- [x] Task 1: Add `readResource` to `client/src/mcp/client.ts` (AC: #1, #8)
  - [x] 1.1 Export `ResourceContent` interface: `{ uri: string; mimeType: string; text: string }`
  - [x] 1.2 Export `readResource(uri: string): Promise<ResourceContent>` that calls `sendJsonRpc("resources/read", { uri })` and returns `result.contents[0]`
  - [x] 1.3 Call `ensureInitialized()` before the request (same pattern as listResources)
  - [x] 1.4 Throw if `result.contents` is missing or empty

- [x] Task 2: Create `client/src/lib/parseMarkdownTable.ts` (AC: #2, #3)
  - [x] 2.1 Export `GridRow` interface: `{ id: string; title: string; priority: string; due: string; status: string }`
  - [x] 2.2 Export `parseMarkdownTable(text: string): GridRow[]` — parses `| ID | Title | Priority | Due | Status |` pipe-delimited table
  - [x] 2.3 Export `parseJsonTaskArray(text: string): GridRow[]` — JSON.parses the string (Task[]) and maps `{ id, title, priority, dueDate → due, status }`
  - [x] 2.4 Both functions return `[]` (not throw) on empty or unparseable input

- [x] Task 3: Create `client/src/lib/taskColumns.ts` (AC: #2, #3, #4, #5)
  - [x] 3.1 Export `TASK_COLUMN_DEFS: ColDef<GridRow>[]` with fields: `id` (width 80), `title` (flex 1), `priority` (width 120), `due` (width 130), `status` (width 120)
  - [x] 3.2 Export `DEFAULT_COL_DEF: ColDef` with `{ sortable: true, filter: true, resizable: true }`

- [x] Task 4: Create `client/src/components/TaskGrid.tsx` (AC: #4, #5, #6)
  - [x] 4.1 Import AG Grid CSS: `ag-grid-community/styles/ag-grid.css` and `ag-grid-community/styles/ag-theme-quartz.css`
  - [x] 4.2 Accept props: `rows: GridRow[]`, `note?: string`, `postAction?: string`
  - [x] 4.3 Local `filterText` state; reset via `key` prop on parent (resource switch resets filter)
  - [x] 4.4 Render: `note` paragraph → `postAction` paragraph → text `<input>` for filter → `<div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>` with `<AgGridReact<GridRow> rowData={rows} columnDefs={TASK_COLUMN_DEFS} defaultColDef={DEFAULT_COL_DEF} quickFilterText={filterText} />`
  - [x] 4.5 Add CSS class `task-grid-wrapper` on outer div for styling

- [x] Task 5: Update `client/src/copy/mcpExplainer.ts` (AC: #6)
  - [x] 5.1 Add `gridNoteResource` key: `"This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP."`

- [x] Task 6: Update `client/src/components/ResourcesPanel.tsx` (AC: #1, #2, #3, #6, #7, #8)
  - [x] 6.1 Add `selectedUri: string | null` state (init `null`)
  - [x] 6.2 Add `readState: { status: 'idle' | 'loading' | 'error'; rows: GridRow[]; error?: string; rawText?: string }` state (init `{ status: 'idle', rows: [] }`)
  - [x] 6.3 Implement `handleRead(uri)` — sets `selectedUri`, sets `readState` to loading+empty, calls `readResource(uri)`, dispatches to `parseMarkdownTable` / `parseJsonTaskArray` by mimeType, updates state; on error sets `status: 'error'` with empty rows
  - [x] 6.4 Make each `item-card` clickable: add `onClick={() => handleRead(r.uri)}` + `role="button"` + highlight selected card with CSS class `item-card--selected`
  - [x] 6.5 Below the item list, render a `<div className="read-result">`:
    - Loading: spinner + "Reading resource…"
    - Error: `<div className="error">{readState.error}</div>`
    - `rawText !== undefined` (text/plain): `<pre className="raw-text">{readState.rawText}</pre>`
    - rows.length > 0: `<TaskGrid key={selectedUri} rows={readState.rows} note={MCP_COPY.gridNoteResource} postAction={MCP_COPY.postActionRead(selectedUri)} />`
    - Idle with no selection: nothing (don't render read-result section)

- [x] Task 7: Add CSS for new elements (AC: #6, #7, styling)
  - [x] 7.1 In `client/src/index.css`, add styles for: `.item-card--selected` (accent border + accent-light bg), `.item-card` cursor pointer, `.read-result` (margin-top 24px), `.grid-note` (italic, small, accent color), `.post-action` (small, green/success tint), `.filter-input` (full-width input), `.raw-text` (monospace pre-wrap), `.task-grid-wrapper` (layout wrapper)

- [x] Task 8: Build and verify (AC: all)
  - [x] 8.1 `npm run build` in root (server unchanged)
  - [x] 8.2 `cd proxy && npm run dev` — proxy starts on 3001
  - [x] 8.3 `cd client && npm run dev` — client starts on 5173
  - [x] 8.4 Click `task://table/by-deadline` → AG Grid appears with task rows, grid note visible
  - [x] 8.5 Click column headers → rows sort client-side
  - [x] 8.6 Type in filter → rows filter live
  - [x] 8.7 Click `task://all` → grid refreshes with same column set (JSON source)
  - [x] 8.8 Click `task://table/by-priority` → grid updates; filter text has reset
  - [x] 8.9 Stop proxy → click resource → inline error shown, no stale grid data
  - [x] 8.10 `cd client && npm run build` — zero TypeScript errors
  - [x] 8.11 `cd client && npm run lint` — zero lint errors

## Dev Notes

### Architecture Overview

This story adds the Resource Read flow to the existing scaffold from Story 4.1. The flow is:

```
User clicks resource card
  → ResourcesPanel.handleRead(uri)
    → readResource(uri) [new client.ts export]
      → POST /mcp  {method: "resources/read", params: {uri}}
        → Proxy forwards to MCP server
        → Returns {contents: [{uri, mimeType, text}]}
    → parse by mimeType (markdown or JSON)
    → setReadState({rows})
  → TaskGrid renders AG Grid with rows
```

No changes to: `src/index.ts` (MCP server), `proxy/`, root `package.json`, `McpContext.tsx`, `ToolsPanel.tsx`, `PromptsPanel.tsx`.

### `readResource` Implementation in client.ts

Add after `listPrompts`:

```typescript
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export async function readResource(uri: string): Promise<ResourceContent> {
  await ensureInitialized();
  const result = await sendJsonRpc("resources/read", { uri });
  const contents = (result as { contents: ResourceContent[] }).contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error("Unexpected response shape from resources/read");
  }
  return contents[0];
}
```

### Markdown Table Parser

The server emits tables in this exact format (from `src/index.ts` `markdownTable` helper):

```
| ID | Title | Priority | Due | Status |
| --- | --- | --- | --- | --- |
| task-1 | Buy groceries | medium | 2026-03-25 | todo |
```

Parse approach:
1. Split text by `\n`
2. Filter lines that start with `|` and end with `|`
3. Line 0 = header; line 1 = separator (skip if contains `---`); lines 2+ = data rows
4. Parse header cells to lowercase field names: `id`, `title`, `priority`, `due`, `status`
5. Parse each data row by splitting on `|`, trimming cells, zipping with headers

```typescript
export interface GridRow {
  id: string;
  title: string;
  priority: string;
  due: string;
  status: string;
}

const HEADER_MAP: Record<string, keyof GridRow> = {
  id: 'id',
  title: 'title',
  priority: 'priority',
  due: 'due',
  status: 'status',
};

export function parseMarkdownTable(text: string): GridRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] =>
    line.slice(1, -1).split('|').map(c => c.trim());

  const headers = parseRow(lines[0]).map(h => h.toLowerCase());
  const dataLines = lines.slice(1).filter(l => !l.includes('---'));

  return dataLines.map(line => {
    const cells = parseRow(line);
    const row: Partial<GridRow> = {};
    headers.forEach((h, i) => {
      const field = HEADER_MAP[h];
      if (field) row[field] = cells[i] ?? '';
    });
    return { id: '', title: '', priority: '', due: '', status: '', ...row };
  });
}

export function parseJsonTaskArray(text: string): GridRow[] {
  try {
    const tasks = JSON.parse(text) as Array<{
      id: string; title: string; priority: string; status: string; dueDate?: string | null;
    }>;
    return tasks.map(t => ({
      id: t.id ?? '',
      title: t.title ?? '',
      priority: t.priority ?? '',
      due: t.dueDate ?? '',
      status: t.status ?? '',
    }));
  } catch {
    return [];
  }
}
```

### AG Grid Column Definitions

```typescript
// client/src/lib/taskColumns.ts
import type { ColDef } from 'ag-grid-community';
import type { GridRow } from './parseMarkdownTable';

export const TASK_COLUMN_DEFS: ColDef<GridRow>[] = [
  { field: 'id',       headerName: 'ID',       width: 80 },
  { field: 'title',    headerName: 'Title',    flex: 1, minWidth: 150 },
  { field: 'priority', headerName: 'Priority', width: 120 },
  { field: 'due',      headerName: 'Due',      width: 130 },
  { field: 'status',   headerName: 'Status',   width: 120 },
];

export const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
};
```

### TaskGrid Component

```tsx
// client/src/components/TaskGrid.tsx
import { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import type { GridRow } from '../lib/parseMarkdownTable';
import { TASK_COLUMN_DEFS, DEFAULT_COL_DEF } from '../lib/taskColumns';

interface TaskGridProps {
  rows: GridRow[];
  note?: string;
  postAction?: string;
}

export function TaskGrid({ rows, note, postAction }: TaskGridProps) {
  const [filterText, setFilterText] = useState('');
  return (
    <div className="task-grid-wrapper">
      {note && <p className="grid-note">{note}</p>}
      {postAction && <p className="post-action">{postAction}</p>}
      <input
        type="text"
        className="filter-input"
        placeholder="Filter rows…"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        aria-label="Filter grid rows"
      />
      <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
        <AgGridReact<GridRow>
          rowData={rows}
          columnDefs={TASK_COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          quickFilterText={filterText}
        />
      </div>
    </div>
  );
}
```

**Critical note:** Use `key={selectedUri}` on `<TaskGrid>` from the parent (`ResourcesPanel`) to automatically reset `filterText` local state when the user switches to a different resource. This is the React idiom for resetting child state without lifting it up.

### ResourcesPanel State and Logic

```typescript
interface ReadState {
  status: 'idle' | 'loading' | 'error';
  rows: GridRow[];
  error?: string;
  rawText?: string; // for text/plain fallback (task://summary)
}
```

```typescript
const [selectedUri, setSelectedUri] = useState<string | null>(null);
const [readState, setReadState] = useState<ReadState>({ status: 'idle', rows: [] });

async function handleRead(uri: string) {
  setSelectedUri(uri);
  setReadState({ status: 'loading', rows: [] }); // clear stale data immediately
  try {
    const content = await readResource(uri);
    if (content.mimeType === 'application/json') {
      setReadState({ status: 'idle', rows: parseJsonTaskArray(content.text) });
    } else if (content.mimeType === 'text/markdown') {
      setReadState({ status: 'idle', rows: parseMarkdownTable(content.text) });
    } else {
      // text/plain fallback (task://summary)
      setReadState({ status: 'idle', rows: [], rawText: content.text });
    }
  } catch (err) {
    setReadState({
      status: 'error',
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

**Render the result area below the item list:**
```tsx
{selectedUri && (
  <div className="read-result">
    {readState.status === 'loading' && (
      <div className="loading"><span className="spinner" />Reading resource…</div>
    )}
    {readState.status === 'error' && (
      <div className="error">{readState.error}</div>
    )}
    {readState.status === 'idle' && readState.rawText !== undefined && (
      <pre className="raw-text">{readState.rawText}</pre>
    )}
    {readState.status === 'idle' && readState.rows.length > 0 && (
      <TaskGrid
        key={selectedUri}
        rows={readState.rows}
        note={MCP_COPY.gridNoteResource}
        postAction={MCP_COPY.postActionRead(selectedUri)}
      />
    )}
    {readState.status === 'idle' && readState.rows.length === 0 && !readState.rawText && (
      <p className="empty-state">No rows found in resource.</p>
    )}
  </div>
)}
```

### AG Grid CSS Import — Critical

Import BOTH CSS files in `TaskGrid.tsx` (not in `main.tsx` or `index.css`):
```typescript
import 'ag-grid-community/styles/ag-grid.css';       // core grid layout
import 'ag-grid-community/styles/ag-theme-quartz.css'; // quartz theme
```

The wrapper div must use className `ag-theme-quartz` for the theme to apply. Do NOT use `ag-theme-alpine` — use `ag-theme-quartz` (available since AG Grid v28, works in v35.1.0).

### AG Grid v35.1.0 — quickFilterText

Pass `quickFilterText` directly as a prop on `<AgGridReact>`. This is valid for AG Grid v31+:
```tsx
<AgGridReact quickFilterText={filterText} ... />
```

Do NOT use the old `gridApi.setQuickFilter(text)` — that API was removed. Do NOT use `gridApi.setGridOption('quickFilterText', text)` — the prop approach is simpler and correct for React.

### CSS Additions to `client/src/index.css`

Add at end of file:

```css
/* Story 4.2 additions */

.item-card {
  cursor: pointer;
}

.item-card--selected {
  border-color: var(--accent);
  background: var(--accent-light);
}

.read-result {
  margin-top: 24px;
}

.task-grid-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-note {
  font-size: 13px;
  color: var(--accent);
  font-style: italic;
  margin: 0;
}

.post-action {
  font-size: 13px;
  color: var(--text);
  margin: 0;
}

.filter-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg);
  color: var(--text-h);
}

.filter-input:focus {
  outline: none;
  border-color: var(--accent);
}

.raw-text {
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

**Note:** The `cursor: pointer` rule is adding to the existing `.item-card` class already in `index.css`. Do NOT duplicate the selector — append only what's missing. You can use `.item-card { cursor: pointer; }` as a separate rule or add it to the existing selector.

### mcpExplainer.ts Addition

```typescript
gridNoteResource: "This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP.",
```

Add this key to the existing `MCP_COPY` const object in `client/src/copy/mcpExplainer.ts`.

### Server Resource Inventory (exact URIs and mimeTypes)

From live server (verified in Story 4.1):

| URI | mimeType | Parser |
|-----|----------|--------|
| `task://all` | `application/json` | `parseJsonTaskArray` |
| `task://summary` | `text/plain` | raw text fallback |
| `task://table/all` | `text/markdown` | `parseMarkdownTable` |
| `task://table/by-deadline` | `text/markdown` | `parseMarkdownTable` |
| `task://table/by-priority` | `text/markdown` | `parseMarkdownTable` |
| `task://table/priority-then-deadline` | `text/markdown` | `parseMarkdownTable` |
| `task://open` | `text/markdown` | `parseMarkdownTable` |

### MCP resources/read Wire Format

```json
// Request
{ "jsonrpc": "2.0", "id": 5, "method": "resources/read", "params": { "uri": "task://table/all" } }

// Response
{
  "result": {
    "contents": [
      {
        "uri": "task://table/all",
        "mimeType": "text/markdown",
        "text": "| ID | Title | Priority | Due | Status |\n| --- | --- | --- | --- | --- |\n| abc | Buy milk | medium |  | todo |\n"
      }
    ]
  }
}
```

`result.contents[0]` is always the item to use. The `text` field holds the content.

### Files Created / Modified This Story

**New files:**
- `client/src/lib/parseMarkdownTable.ts`
- `client/src/lib/taskColumns.ts`
- `client/src/components/TaskGrid.tsx`

**Modified files:**
- `client/src/mcp/client.ts` (add `readResource`, `ResourceContent`)
- `client/src/copy/mcpExplainer.ts` (add `gridNoteResource`)
- `client/src/components/ResourcesPanel.tsx` (add click handler, read state, grid render)
- `client/src/index.css` (add new CSS rules)

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server)
- `proxy/` (proxy unchanged)
- `package.json` (root)
- `client/src/context/McpContext.tsx`
- `client/src/components/ToolsPanel.tsx`
- `client/src/components/PromptsPanel.tsx`
- `client/src/App.tsx`
- `client/src/main.tsx`

### Anti-Patterns to Avoid

1. **Do NOT add `readResource` to McpContext** — resource reading is local action state in ResourcesPanel; the architecture says "local state for forms and selection" (context is for connection + list state)
2. **Do NOT install any markdown parsing library** (e.g. `marked`, `remark`) — the server table format is simple and regular; write the 15-line parser yourself
3. **Do NOT import AG Grid CSS in `main.tsx` or `index.css`** — import in `TaskGrid.tsx` to keep concerns co-located and avoid CSS conflicts
4. **Do NOT use `ag-theme-alpine`** — use `ag-theme-quartz`; both are available in v35 but quartz is the current recommended theme
5. **Do NOT use `gridApi.setQuickFilter()`** — removed in AG Grid v31+; use `quickFilterText` prop on `<AgGridReact>`
6. **Do NOT show stale rows on error** — `setReadState({ status: 'error', rows: [] })` clears rows immediately (AC8)
7. **Do NOT forget `key={selectedUri}` on `<TaskGrid>`** — without it, `filterText` state inside TaskGrid won't reset when switching resources
8. **Do NOT put `cursor: pointer` as an inline style** — add to `index.css`; the `.item-card:hover` rule already exists there
9. **Do NOT import `GridRow` type in `taskColumns.ts` with a value import** — use `import type { GridRow }` (ESM type-only import)
10. **Do NOT add routing or tabs** — single page with sections; grid appears within the Resources panel section
11. **Do NOT skip the text/plain fallback** — `task://summary` has mimeType `text/plain`; trying to parse it as markdown returns empty rows, which is confusing; show raw text instead

### Previous Story Intelligence (from Story 4.1, done 2026-03-20)

- `sendJsonRpc`, `ensureInitialized`, and all list helpers exist in `client/src/mcp/client.ts` — extend, don't rewrite
- `MCP_COPY` const in `mcpExplainer.ts` already has `postActionRead(uri)` function — use it directly
- CSS variables are defined in `index.css`: `--accent`, `--accent-light`, `--border`, `--bg`, `--error`, `--error-bg`, `--error-border`, `--text`, `--text-h`, `--mono` — use these, don't hardcode colors
- `.spinner` CSS keyframe animation already exists in `index.css` — reuse `<span className="spinner" />` pattern for loading
- `.panel .error` class already styled — reuse for read errors inside the panel
- `.item-card` class styled with `border`, `border-radius`, `transition` — add `--selected` variant only
- ESLint config requires: no unused vars, react-hooks rules, react-refresh rules — `handleRead` must be used; avoid anonymous inline async in onClick (define named function)
- Scaffold issue: `McpContext.tsx` uses `// eslint-disable-next-line react-refresh/only-export-components` for co-located hook — note this pattern if needed
- `initPromise ??= ...` pattern in client.ts ensures `ensureInitialized` is idempotent and safe to call from `readResource`

### Tech Stack Reference

| Item | Value |
|------|-------|
| AG Grid | Community v35.1.0 (`ag-grid-react`, `ag-grid-community`) |
| AG Grid Theme | `ag-theme-quartz` (CSS import) |
| AG Grid Quick Filter | `quickFilterText` prop on `<AgGridReact>` |
| AG Grid Column Type | `ColDef<GridRow>` from `ag-grid-community` |
| React | 19.2.4 + TypeScript ~5.9.3 |
| Vite | 8.0.1 (dev server stays on 5173) |
| State management | local `useState` in ResourcesPanel (not context) |
| CSS | Plain CSS in `index.css` (no Tailwind) |

### Verification Steps

1. **Proxy running:** `cd proxy && npm run dev` → `MCP proxy listening on http://localhost:3001`
2. **Client running:** `cd client && npm run dev` → Vite on `localhost:5173`
3. **Click `task://table/by-deadline`** → AG Grid renders below resource list; grid note visible; `postActionRead` message visible
4. **Column header click** → rows sort by that column
5. **Type "todo" in filter** → rows filter to matching status
6. **Click `task://all`** → grid refreshes with same 5 columns (JSON source); filter input cleared
7. **Click `task://table/by-priority`** → rows re-sorted server-side (priority is grid column too)
8. **Click `task://summary`** → raw plain text shown (not grid, not empty)
9. **Stop proxy → click any resource** → inline error appears; no stale grid rows visible
10. **`cd client && npm run build`** → zero TypeScript errors
11. **`cd client && npm run lint`** → zero lint errors
12. **Verify blurbs unchanged** — ResourcesPanel still shows `MCP_COPY.resourcesBlurb` at top (regression check)
13. **Verify other panels unaffected** — ToolsPanel and PromptsPanel render identically to Story 4.1

## Definition of Done

- [x] `client/src/mcp/client.ts` exports `readResource` and `ResourceContent`
- [x] `client/src/lib/parseMarkdownTable.ts` exports `GridRow`, `parseMarkdownTable`, `parseJsonTaskArray`
- [x] `client/src/lib/taskColumns.ts` exports `TASK_COLUMN_DEFS` and `DEFAULT_COL_DEF`
- [x] `client/src/components/TaskGrid.tsx` renders AG Grid with filter input, note, and post-action copy
- [x] AG Grid CSS imported correctly; `ag-theme-quartz` theme applied
- [x] `ResourcesPanel` cards are clickable, selected card highlighted, grid renders below list
- [x] Switching resources updates grid and resets filter text
- [x] Error on read: inline error shown, rows cleared
- [x] `task://summary` (text/plain): raw text shown instead of empty grid
- [x] `MCP_COPY.gridNoteResource` key added in `mcpExplainer.ts`
- [x] No changes to server, proxy, McpContext, ToolsPanel, PromptsPanel, App.tsx
- [x] `npm run build` in `client/` — zero TypeScript errors
- [x] `npm run lint` in `client/` — zero lint errors

## File List

**New files:**
- `client/src/lib/parseMarkdownTable.ts`
- `client/src/lib/taskColumns.ts`
- `client/src/components/TaskGrid.tsx`

**Modified files:**
- `client/src/mcp/client.ts`
- `client/src/copy/mcpExplainer.ts`
- `client/src/components/ResourcesPanel.tsx`
- `client/src/index.css`

## Change Log

- 2026-03-20: Implemented Story 4.2 — Resource Read flow with AG Grid display. Added `readResource`/`ResourceContent` to client.ts; created `parseMarkdownTable.ts` (markdown table + JSON array parsers); created `taskColumns.ts` (AG Grid column definitions); created `TaskGrid.tsx` component with filter input and `ag-theme-quartz`; updated `ResourcesPanel.tsx` with click-to-read, selected card highlight, loading/error/grid/raw-text render states; added `gridNoteResource` to `mcpExplainer.ts`; added CSS for new elements. Build and lint both pass with zero errors.

## Dev Agent Record

### Implementation Plan

Followed the story task sequence exactly. All implementation used existing patterns from Story 4.1 (same `sendJsonRpc`/`ensureInitialized` pattern, same CSS variables, same spinner pattern). The `key={selectedUri}` prop on `<TaskGrid>` in `ResourcesPanel` resets `filterText` local state automatically on resource switch (React key idiom). No external markdown parsing library was used; wrote the 15-line pipe-delimited parser as specified.

### Completion Notes

- All 8 tasks and all subtasks implemented and verified.
- `client/npm run build` — zero TypeScript errors (30 modules transformed).
- `client/npm run lint` — zero ESLint errors.
- The `handleRead` async function is defined as a named function (not anonymous inline) to satisfy ESLint react-hooks rules.
- `text/plain` fallback (for `task://summary`) renders raw text via `<pre className="raw-text">` to avoid confusing empty-grid state.
- Story ACs 1–8 all satisfied by the implemented code.
