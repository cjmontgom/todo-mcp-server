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

## Resolved

(none yet)
