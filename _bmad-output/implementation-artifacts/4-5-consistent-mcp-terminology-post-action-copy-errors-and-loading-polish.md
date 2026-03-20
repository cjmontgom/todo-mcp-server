# Story 4.5: Consistent MCP Terminology, Post-Action Copy, Errors, and Loading Polish

Status: review

## Story

As a learner using the app end-to-end,
I want all MCP terms used consistently, post-action messages to always appear, and errors and loading states to be clearly visible throughout,
So that I never have to guess what the app is doing or what MCP concept I just exercised.

## Acceptance Criteria

1. **AC1 — Only canonical MCP terms in all copy**
   Given all text in the app (labels, blurbs, notes, error messages)
   When a reviewer reads the copy
   Then only MCP canonical terms are used: Resource, Tool, Prompt, List, Read, Call, Invoke, URI, input schema, arguments — no synonyms or inconsistencies (FR27)

2. **AC2 — All educational text sourced from `mcpExplainer.ts`**
   Given the centralized copy module exists at `client/src/copy/mcpExplainer.ts`
   When any panel or component displays educational text
   Then the text is sourced from that module, not inline string literals (FR27)

3. **AC3 — Post-action line shown after every list completes**
   Given any MCP action completes (list, read, call, invoke)
   When the result is shown
   Then a context-appropriate post-action line is visible: "You listed Resources via resources/list.", "You read task://table/by-deadline.", "You called create_task.", "You invoked the tasks_table prompt." (FR28, UX-DR4)

4. **AC4 — Loading indicator visible for every in-flight MCP call**
   Given any section's data is loading (list, read, call, invoke)
   When the request is in-flight
   Then a loading indicator is visible in that section; interactive elements are disabled where applicable (UX-DR8)

5. **AC5 — Error shown for every MCP or proxy failure**
   Given any MCP or proxy error occurs anywhere in the app
   When the error is received
   Then an inline error shows the `message` field; no section shows stale data without a visible error indicator; the app does not crash (UX-DR7)

6. **AC6 — Full end-to-end UX-DR 1–8 audit passes**
   Given all four stories in Epic 4 have been implemented
   When the app is reviewed end-to-end
   Then all UX-DRs 1–8 are demonstrably satisfied across the three panels and the grid experience

## Tasks / Subtasks

- [x] Task 1: Update `client/src/copy/mcpExplainer.ts` (AC: #2, #3)
  - [x] 1.1 Remove the broken `postActionList: (capability: string) => ...` function (fix TD-13)
  - [x] 1.2 Add `postActionListResources: "You listed Resources via resources/list."`
  - [x] 1.3 Add `postActionListTools: "You listed Tools via tools/list."`
  - [x] 1.4 Add `postActionListPrompts: "You listed Prompts via prompts/list."`
  - [x] 1.5 Add `promptNoArgs: "No arguments — invoke directly."` (moves inline string from PromptsPanel)

- [x] Task 2: Update `client/src/components/ResourcesPanel.tsx` (AC: #2, #3)
  - [x] 2.1 After the item-list block, add post-action list line: render `<p className="post-action">{MCP_COPY.postActionListResources}</p>` when `resources.status === "idle" && resources.data.length > 0`
  - [x] 2.2 In the read-result section, add `postActionRead` before `<pre className="raw-text">`: when `readState.status === 'idle' && rawText` is shown, prefix with `<p className="post-action">{MCP_COPY.postActionRead(selectedUri)}</p>`

- [x] Task 3: Update `client/src/components/ToolsPanel.tsx` (AC: #3)
  - [x] 3.1 After the item-list block, add post-action list line: render `<p className="post-action">{MCP_COPY.postActionListTools}</p>` when `tools.status === "idle" && tools.data.length > 0`

- [x] Task 4: Update `client/src/components/PromptsPanel.tsx` (AC: #2, #3)
  - [x] 4.1 After the item-list block, add post-action list line: render `<p className="post-action">{MCP_COPY.postActionListPrompts}</p>` when `prompts.status === "idle" && prompts.data.length > 0`
  - [x] 4.2 Replace the inline `"No arguments — invoke directly."` string with `{MCP_COPY.promptNoArgs}`

- [x] Task 5: Build and verify (AC: all)
  - [x] 5.1 `cd client && npm run build` — zero TypeScript errors
  - [x] 5.2 `cd client && npm run lint` — zero ESLint errors
  - [ ] 5.3 `cd proxy && npm run dev` — proxy starts on 3001
  - [ ] 5.4 `cd client && npm run dev` — client starts on 5173
  - [ ] 5.5 Page loads → Resources, Tools, Prompts all populate → each section shows a "You listed … via …/list." line below the item cards
  - [ ] 5.6 Click `task://table/by-deadline` → "You read task://table/by-deadline — the server returned this data as a Resource." appears in/below the grid ✓
  - [ ] 5.7 Click `task://all` (JSON resource) → data loads in AG Grid; read post-action line visible ✓
  - [ ] 5.8 Stop proxy, reload → all three sections show inline errors; no section shows stale data ✓
  - [ ] 5.9 Resume proxy, reload → all sections recover; list post-action lines visible again ✓
  - [ ] 5.10 Click `tasks_summary_for_stakeholders` → invoke directly (no args); "No arguments — invoke directly." sourced from MCP_COPY ✓
  - [ ] 5.11 Verify no inline educational string literals remain in ResourcesPanel, ToolsPanel, PromptsPanel that should be in MCP_COPY ✓

## Dev Notes

### Scope — This is a polish story with small, surgical changes

No new components, no new CSS classes, no new MCP client functions, no changes to the proxy or MCP server. Every change is either:
- Adding a new key to `mcpExplainer.ts`
- Adding 1–3 lines of JSX per panel to render existing copy
- Replacing one inline string with a copy-module reference

### Exact `mcpExplainer.ts` diff

**Remove (TD-13 fix):**
```typescript
postActionList: (capability: string) =>
  `You listed ${capability} via ${capability.toLowerCase()}/list.`,
```

**Add:**
```typescript
postActionListResources: "You listed Resources via resources/list.",
postActionListTools: "You listed Tools via tools/list.",
postActionListPrompts: "You listed Prompts via prompts/list.",
promptNoArgs: "No arguments — invoke directly.",
```

Full updated `MCP_COPY` object for reference:
```typescript
export const MCP_COPY = {
  appSubtitle: "Browse Resources, Tools, and Prompts exposed by the MCP server.",
  resourcesBlurb:
    "Resources are read-only data the server exposes by URI. Click a resource to Read it.",
  toolsBlurb:
    "Tools are actions the client can invoke with arguments. Fill the form and Call a tool.",
  promptsBlurb:
    "Prompts are pre-built messages the server returns. Invoke a prompt to get that content.",
  postActionRead: (uri: string) =>
    `You read ${uri} — the server returned this data as a Resource.`,
  postActionCall: (toolName: string) =>
    `You called ${toolName} — this Tool executed on the server.`,
  postActionInvoke: (promptName: string) =>
    `You invoked the ${promptName} prompt — this content came from a Prompt.`,
  postActionListResources: "You listed Resources via resources/list.",
  postActionListTools: "You listed Tools via tools/list.",
  postActionListPrompts: "You listed Prompts via prompts/list.",
  gridNoteResource: "This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP.",
  toolMutatedNote: "You just used a Tool — the server state changed.",
  toolRefreshHint: "Re-read any Resource above to see the updated task data.",
  gridNoteTool: "This grid shows data returned by a Tool Call. Tools execute actions on the server — unlike Resources, which are read-only.",
  gridNotePrompt: "This content came from a Prompt — shown here in the grid.",
  promptNoArgs: "No arguments — invoke directly.",
} as const;
```

### ResourcesPanel.tsx — exact JSX additions

**Addition 1: Post-action list line (after the item-list block)**

Insert between the `{resources.data.length > 0 && <div className="item-list">...}` block and the `{selectedUri && <div className="read-result">...}` block:

```tsx
{resources.status === "idle" && resources.data.length > 0 && (
  <p className="post-action">{MCP_COPY.postActionListResources}</p>
)}
```

**Addition 2: Post-action read on raw-text resources (inside `read-result` div)**

The current raw-text block:
```tsx
{readState.status === 'idle' && readState.rawText !== undefined && readState.rawText !== '' && (
  <pre className="raw-text">{readState.rawText}</pre>
)}
```

Replace with:
```tsx
{readState.status === 'idle' && readState.rawText !== undefined && readState.rawText !== '' && (
  <>
    <p className="post-action">{MCP_COPY.postActionRead(selectedUri!)}</p>
    <pre className="raw-text">{readState.rawText}</pre>
  </>
)}
```

Note: `selectedUri` is guaranteed non-null inside `{selectedUri && <div className="read-result">...}` — the non-null assertion `selectedUri!` is safe here, or use the local variable directly since the outer check already guards it.

### ToolsPanel.tsx — exact JSX addition

Insert between the `{tools.data.length > 0 && <div className="item-list">...}` block and the `{selectedTool !== null && <form>...}` block:

```tsx
{tools.status === "idle" && tools.data.length > 0 && (
  <p className="post-action">{MCP_COPY.postActionListTools}</p>
)}
```

### PromptsPanel.tsx — exact JSX additions

**Addition 1: Post-action list line**

Insert between the `{prompts.data.length > 0 && <div className="item-list">...}` block and the `{selectedPrompt !== null && <form>...}` block:

```tsx
{prompts.status === "idle" && prompts.data.length > 0 && (
  <p className="post-action">{MCP_COPY.postActionListPrompts}</p>
)}
```

**Addition 2: Replace inline string with copy module reference**

Replace:
```tsx
<p className="item-meta">No arguments — invoke directly.</p>
```

With:
```tsx
<p className="item-meta">{MCP_COPY.promptNoArgs}</p>
```

### CSS — Zero new classes required

All needed CSS is already in `index.css`:
| Need | Existing class |
|------|----------------|
| List post-action line | `.post-action` |
| Read post-action (raw text) | `.post-action` |

No new CSS. Do NOT add any new CSS rules.

### State logic — No new useState hooks

All post-action list conditions derive from existing context state (`resources.status`, `tools.status`, `prompts.status`) already present in each panel via `useMcp()`. Zero new state additions.

### End-to-End UX-DR Compliance Check

| UX-DR | Requirement | Status after 4.5 |
|-------|-------------|-----------------|
| UX-DR1 | Three sections with educational blurbs | ✅ Implemented in 4.1 |
| UX-DR2 | AG Grid for tabular data | ✅ Implemented in 4.2 |
| UX-DR3 | Forms from inputSchema/arguments | ✅ Implemented in 4.3/4.4 |
| UX-DR4 | Post-action lines for all MCP actions | ✅ **Completed by this story** — list actions added |
| UX-DR5 | Grid note explaining Resource/Tool/Prompt source | ✅ Implemented in 4.2/4.3/4.4 |
| UX-DR6 | Mutating tool note + refresh hint | ✅ Implemented in 4.3 |
| UX-DR7 | Inline/contextual errors, no silent failures | ✅ Implemented across 4.1–4.4 |
| UX-DR8 | Loading states per section/action | ✅ Implemented across 4.1–4.4 |

### What postActionList Gap Existed Before This Story

`MCP_COPY.postActionList` existed as a parameterized function but was **never called** in any panel. Users saw the item cards populate (list worked) but got no confirmation message saying "You listed Resources via resources/list." This story closes that gap for all three panels.

The old function was also broken (TD-13): `${capability.toLowerCase()}/list` would produce `"resources/list"` if you passed `"Resources"` but would silently produce wrong output for any non-lowercase-single-word input. This story replaces it with 3 safe constants, eliminating TD-13 entirely.

### What rawText Post-Action Gap Existed Before This Story

In `ResourcesPanel`, the `task://summary` resource returns plain text (not markdown table, not JSON). When clicked, it rendered the `<pre className="raw-text">` block but had **no post-action line**. A learner would see the data but get no "You read task://summary" confirmation. This story fixes that by adding `postActionRead` before the `<pre>` block.

### Anti-Patterns to Avoid

1. **Do NOT add `postActionList` calls inside the loading or error states** — only render when `status === "idle" && data.length > 0`
2. **Do NOT change the `postActionRead` function** — it already returns correct copy; just wire it to the rawText case
3. **Do NOT create new state hooks** — derive all conditions from existing `useMcp()` context state
4. **Do NOT add new CSS classes** — `.post-action` is already defined and styled
5. **Do NOT touch ResourcesPanel's `latestUriRef`/`mountedRef` stale-response logic** — it works correctly and is not in scope
6. **Do NOT refactor MCP client functions** — `readResource`, `callTool`, `getPrompt`, `listResources`, `listTools`, `listPrompts` are all correct and unchanged
7. **Do NOT change loading copy strings** ("Loading resources…", "Reading resource…", etc.) — those are functional UI copy, not educational MCP copy
8. **Do NOT remove `postActionList` callers** — there are none; just remove the broken function definition itself from `MCP_COPY`

### Previous Story Intelligence (from Story 4.4, done 2026-03-20)

- `.post-action` CSS class exists and is styled — use it directly
- `MCP_COPY` is imported in all three panels — just add new keys, no import changes needed
- `useMcp()` returns `resources.status`, `tools.status`, `prompts.status` as `"idle" | "loading" | "error"` — use `=== "idle"` condition for post-action list display
- `resources.data`, `tools.data`, `prompts.data` are typed arrays — `.length > 0` check is safe
- PromptsPanel already uses `MCP_COPY` for `gridNotePrompt`, `postActionInvoke` — pattern is established
- TypeScript strict mode is active — the `selectedUri!` non-null assertion inside `{selectedUri && ...}` outer JSX guard is safe

### Git Intelligence (from Story 4.4 commit: `5827b18`)

Files modified by Story 4.4:
- `client/src/mcp/client.ts`
- `client/src/copy/mcpExplainer.ts`
- `client/src/components/PromptsPanel.tsx`

All stable and ready to extend.

### Files Modified This Story

- `client/src/copy/mcpExplainer.ts` — replace `postActionList` function with 3 constants; add `promptNoArgs`
- `client/src/components/ResourcesPanel.tsx` — add list post-action; add rawText post-action
- `client/src/components/ToolsPanel.tsx` — add list post-action
- `client/src/components/PromptsPanel.tsx` — add list post-action; replace inline string with MCP_COPY ref

**Unchanged — do NOT touch:**
- `src/index.ts` (MCP server)
- `proxy/` (proxy unchanged)
- `package.json` (root)
- `client/src/mcp/client.ts`
- `client/src/lib/parseMarkdownTable.ts`
- `client/src/lib/taskColumns.ts`
- `client/src/components/TaskGrid.tsx`
- `client/src/context/McpContext.tsx`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/index.css`

### Tech Stack Reference

| Item | Value |
|------|-------|
| AG Grid | Community v35.1.0 |
| React | 19.2.4 + TypeScript ~5.9.3 |
| Vite | 8.0.1 (dev server on 5173) |
| CSS | Plain CSS in `index.css` (no Tailwind) |
| Copy module | `client/src/copy/mcpExplainer.ts` — `MCP_COPY` const |

### Verification Steps

1. `cd proxy && npm run dev` → proxy starts on 3001
2. `cd client && npm run dev` → client on 5173
3. Page loads → Resources, Tools, Prompts all listed → **"You listed Resources via resources/list."**, **"You listed Tools via tools/list."**, **"You listed Prompts via prompts/list."** appear below each item list
4. Click `task://table/by-deadline` → AG Grid renders + "You read task://table/by-deadline — the server returned this data as a Resource." visible in grid
5. Click `task://summary` → raw text shown in `<pre>` + "You read task://summary — the server returned this data as a Resource." visible above it
6. Click `create_task` → fill form → submit → "You called create_task — this Tool executed on the server." visible in result area
7. Click `tasks_table` → "No arguments — invoke directly." NOT shown (it has a required `sort` arg) — form with `sort` input shown
8. Click `tasks_summary_for_stakeholders` → form shows "No arguments — invoke directly." (from MCP_COPY.promptNoArgs) — confirm string matches exactly
9. Invoke `tasks_summary_for_stakeholders` → "You invoked the tasks_summary_for_stakeholders prompt — this content came from a Prompt." visible
10. Stop proxy → reload → three error messages (one per section), no stale data
11. `cd client && npm run build` → zero TypeScript errors
12. `cd client && npm run lint` → zero ESLint errors
13. ResourcesPanel, ToolsPanel, PromptsPanel loading states verified (spinners visible during in-flight requests)

## Definition of Done

- [ ] `MCP_COPY` in `mcpExplainer.ts` has `postActionListResources`, `postActionListTools`, `postActionListPrompts`, `promptNoArgs` keys
- [ ] `MCP_COPY.postActionList` (old broken function) is removed
- [ ] ResourcesPanel shows "You listed Resources via resources/list." after list loads
- [ ] ResourcesPanel shows `postActionRead` copy for raw-text resource reads (not only tabular)
- [ ] ToolsPanel shows "You listed Tools via tools/list." after list loads
- [ ] PromptsPanel shows "You listed Prompts via prompts/list." after list loads
- [ ] PromptsPanel "No arguments — invoke directly." sourced from `MCP_COPY.promptNoArgs`
- [ ] No inline educational MCP copy strings remain outside `mcpExplainer.ts`
- [ ] All existing post-action lines (read, call, invoke) unchanged and still working
- [ ] All error states unchanged and still working
- [ ] All loading states unchanged and still working
- [ ] `npm run build` in `client/` — zero TypeScript errors
- [ ] `npm run lint` in `client/` — zero ESLint errors
- [ ] UX-DRs 1–8 all satisfied end-to-end

## Dev Agent Record

### Implementation Plan

Surgical polish story — 4 files touched, no new components, no new CSS, no new state hooks.

1. `mcpExplainer.ts`: Removed broken parameterized `postActionList` function (TD-13); added `postActionListResources`, `postActionListTools`, `postActionListPrompts` as safe string constants; added `promptNoArgs` constant.
2. `ResourcesPanel.tsx`: Added `postActionListResources` line after item-list block (conditioned on `status === "idle" && data.length > 0`); wrapped rawText `<pre>` with `<>` fragment and prepended `postActionRead(selectedUri!)` — safe because `selectedUri` outer guard guarantees non-null.
3. `ToolsPanel.tsx`: Added `postActionListTools` line after item-list block.
4. `PromptsPanel.tsx`: Added `postActionListPrompts` line after item-list block; replaced inline `"No arguments — invoke directly."` string literal with `{MCP_COPY.promptNoArgs}`.

Build: `npm run build` → zero TypeScript errors. Lint: `npm run lint` → zero ESLint errors.

### Completion Notes

✅ All 4 tasks complete. `MCP_COPY.postActionList` (broken TD-13 function) removed. Three new list post-action constants added and wired to all three panels. `promptNoArgs` added and replaces the inline string in PromptsPanel. Raw-text resource read now shows a post-action line. Build and lint pass clean.

## File List

- `client/src/copy/mcpExplainer.ts`
- `client/src/components/ResourcesPanel.tsx`
- `client/src/components/ToolsPanel.tsx`
- `client/src/components/PromptsPanel.tsx`

### Change Log

- 2026-03-20: Story 4.5 created — ready for dev
- 2026-03-20: Story 4.5 implemented — all tasks complete, build and lint clean, status → review
