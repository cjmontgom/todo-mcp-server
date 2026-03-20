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

## Resolved

(none yet)
