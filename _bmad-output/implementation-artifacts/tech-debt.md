# Tech Debt

Items surfaced during code reviews that are real but not caused by the change under review. Tracked here for future attention.

## Open

### TD-1: `create_task` has no `completedAt` awareness
- **Surfaced in:** Story 2.2 code review (2026-03-20)
- **Risk:** Low (currently safe — `create_task` hardcodes `status: "todo"`)
- **Detail:** If a future change allows creating tasks with an initial status of `"done"`, `completedAt` will remain `undefined`. No guard or comment documents this assumption.

### TD-2: `tasks_table` prompt throws misleading error for missing `sort` argument
- **Surfaced in:** Story 2.2 code review (2026-03-20)
- **Risk:** Low
- **Detail:** When `sort` is omitted, the error reads `Invalid sort value: "undefined"` rather than distinguishing "missing required argument" from "invalid value." Introduced in Story 2.1.

### TD-3: `update_task_status` does not validate status value server-side
- **Surfaced in:** Story 2.2 code review (2026-03-20)
- **Risk:** Medium
- **Detail:** Unlike `update_task`, which checks `VALID_STATUSES.includes(...)` before applying, `update_task_status` casts `args.status` directly without validation. An invalid status like `"cancelled"` would be silently accepted. The tool schema `enum` constraint is client-advisory only. Introduced in Story 1.2. Location: `src/index.ts:431`.

### TD-4: UTC timezone assumption in overdue detection
- **Surfaced in:** Story 2.2 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `new Date().toISOString().slice(0, 10)` produces today's date in UTC. Tasks due "today" in a non-UTC timezone could be incorrectly flagged as overdue after midnight UTC but before midnight local. Affects `tasks_summary_for_stakeholders` prompt. Location: `src/index.ts:571`.

### TD-5: No auto-restart when MCP server child process exits
- **Surfaced in:** Story 3.1 code review (2026-03-20)
- **Risk:** Low (MVP — single-user dev tool)
- **Detail:** When the child process exits, the proxy is permanently broken (returns 503) until manually restarted. The spec only requires logging and error responses, which are implemented. Auto-restart with backoff would improve resilience.
- **Location:** `proxy/src/index.ts` — `bridge.on("exit")` handler

### TD-6: `alive` flag set before child process is ready
- **Surfaced in:** Story 3.1 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `this.alive = true` is set immediately after `spawn()`, before the child's stdin reader is initialized. A request arriving in this tiny window could be written to a pipe that isn't being read yet. The MCP `initialize` handshake mitigates this at the protocol level.
- **Location:** `proxy/src/spawnMcpServer.ts:24`

### TD-7: `kill()` has no SIGKILL fallback
- **Surfaced in:** Story 3.1 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `this.process?.kill()` sends SIGTERM but has no deadline. If the child ignores SIGTERM, shutdown stalls indefinitely. A timeout with SIGKILL fallback would make shutdown more robust.
- **Location:** `proxy/src/spawnMcpServer.ts:94`

### TD-8: No tests for proxy package
- **Surfaced in:** Story 3.1 code review (2026-03-20)
- **Risk:** Medium
- **Detail:** Zero test files exist for the bridge class, HTTP layer, or SSE logic. The story had no testing AC, but test coverage for request correlation, error paths, and SSE lifecycle would prevent regressions.
- **Location:** `proxy/`

### TD-9: stdin write backpressure not handled
- **Surfaced in:** Story 3.1 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `this.process.stdin.write()` return value is not checked. If the pipe buffer is full, data could be lost silently. Unlikely with small JSON-RPC messages, and write failures would trigger exit/error handlers.
- **Location:** `proxy/src/spawnMcpServer.ts:90`

### TD-10: No JSON-RPC `id` correlation on responses
- **Surfaced in:** Story 4.1 code review (2026-03-20)
- **Risk:** Low (MVP — single session, bounded parallelism)
- **Detail:** `sendJsonRpc` in `client/src/mcp/client.ts` increments a request `id` but never checks whether the received `data.id` matches. With concurrent in-flight calls (e.g. three parallel list requests), a mis-paired response would silently return wrong data. Acceptable for the current single-session MVP; revisit as Stories 4.2+ add more concurrent calls.
- **Location:** `client/src/mcp/client.ts` — `sendJsonRpc`

### TD-11: `setState` after unmount in `McpProvider`
- **Surfaced in:** Story 4.1 code review (2026-03-20)
- **Risk:** Low (React 18 suppresses the warning)
- **Detail:** The `useEffect` in `McpProvider` fires three async fetches with no cleanup/cancellation. If the component unmounts before any fetch resolves, the resulting `setState` calls run on an unmounted component. React 18 suppresses the console warning but the pattern is still incorrect. Address when the client gains reconnect or abort-controller logic.
- **Location:** `client/src/context/McpContext.tsx` — `useEffect`

### TD-12: Module-level `initialized` flag never resets across HMR hot reloads
- **Surfaced in:** Story 4.1 code review (2026-03-20)
- **Risk:** Low (dev-only nuisance)
- **Detail:** `let initialized = false` in `client/src/mcp/client.ts` is module-level state. During Vite HMR, module-level state is often preserved, so a reload that changes the proxy URL or MCP server capabilities will not re-run the `initialize` handshake. Address when the client gains reconnect logic or a reset mechanism.
- **Location:** `client/src/mcp/client.ts` — `initialized`, `ensureInitialized`

### TD-13: `postActionList` conflates capability display name with MCP method segment
- **Surfaced in:** Story 4.1 code review (2026-03-20)
- **Risk:** Low (unused in Story 4.1)
- **Detail:** `postActionList: (capability: string) => \`You listed ${capability} via ${capability.toLowerCase()}/list.\`` assumes the `capability` argument is a single lowercase word that maps directly to the MCP method path segment. Any display label with spaces or mixed casing would produce a misleading string. Address when the helper is first consumed in Story 4.5.
- **Location:** `client/src/copy/mcpExplainer.ts` — `postActionList`

### TD-14: Duplicate React `key` if server returns collisions on URI or name
- **Surfaced in:** Story 4.1 code review (2026-03-20)
- **Risk:** Low (current server guarantees unique URIs and tool/prompt names)
- **Detail:** `ResourcesPanel` keys items by `r.uri`, `ToolsPanel` and `PromptsPanel` by `t.name` / `p.name`. If a future server returns duplicate identifiers, React will warn and reconciliation will be unstable. Guarded entirely by the known server's uniqueness constraints today; revisit if the client is generalised to connect to arbitrary MCP servers.
- **Location:** `client/src/components/ResourcesPanel.tsx`, `ToolsPanel.tsx`, `PromptsPanel.tsx`

### TD-15: `readResource` error message omits the failing URI
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `throw new Error("Unexpected response shape from resources/read")` contains no reference to the URI that was requested. When multiple resources exist, diagnosing which resource produced the malformed response requires checking network logs rather than reading the error message directly.
- **Location:** `client/src/mcp/client.ts` — `readResource`

### TD-16: Markdown table parser does not tolerate alternate header labels
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low (current server always emits exact headers)
- **Detail:** `parseMarkdownTable` maps headers via a fixed `HEADER_MAP` keyed on `id`, `title`, `priority`, `due`, `status`. Common variants (`due date`, `duedate`, `ID`, etc.) produce empty or missing columns with no warning. Safe for the current server but would silently break if the server's `markdownTable` helper is changed or if the client is pointed at a different MCP server.
- **Location:** `client/src/lib/parseMarkdownTable.ts` — `HEADER_MAP`

### TD-17: `TaskGrid` grid height is hard-coded at 400px
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `<div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>` uses a fixed pixel height regardless of viewport size or row count. On small screens the grid is cramped; for sparse datasets it shows a large empty area. Address with a responsive height strategy (e.g. `autoHeight`, viewport-relative height, or a CSS custom property) in a future polish story.
- **Location:** `client/src/components/TaskGrid.tsx:28`

### TD-18: Column `filter: true` and quick-filter input are both active without UX differentiation
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low
- **Detail:** `DEFAULT_COL_DEF` sets `filter: true`, enabling per-column AG Grid filter menus, while `TaskGrid` also renders a free-text quick-filter input. Both mechanisms are in spec and both work correctly, but there is no label or tooltip explaining the distinction to a learner audience. Address in Story 4.5 (copy and UX polish).
- **Location:** `client/src/lib/taskColumns.ts`, `client/src/components/TaskGrid.tsx`

### TD-19: AG Grid CSS theme imports are co-located inside `TaskGrid.tsx`
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low (intentional per dev notes)
- **Detail:** Importing `ag-grid.css` and `ag-theme-quartz.css` inside the component keeps concerns co-located but couples global theme side-effects to a single component. If `TaskGrid` is ever rendered in multiple routes or lazy-loaded, repeated CSS registration could produce ordering issues in some bundlers. Dev notes explicitly prescribed this placement; revisit when the app gains multiple routes or lazy-loaded chunks.
- **Location:** `client/src/components/TaskGrid.tsx:3-4`

### TD-20: Any valid pipe-delimited markdown table silently renders blank rows if headers don't match task schema
- **Surfaced in:** Story 4.2 code review (2026-03-20)
- **Risk:** Low (current server always emits the task schema)
- **Detail:** `parseMarkdownTable` accepts any pipe table and zips cells against the task `HEADER_MAP`. A resource with different column names produces rows of empty strings with no warning. The grid renders but shows no data, which appears identical to a legitimately empty resource. Safe for the current server; would silently mislead if the client is generalised to arbitrary MCP servers.
- **Location:** `client/src/lib/parseMarkdownTable.ts` — `parseMarkdownTable`

## Resolved

(none yet)
