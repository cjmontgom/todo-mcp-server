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

## Resolved

(none yet)
