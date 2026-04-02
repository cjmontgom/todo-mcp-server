# Story 7.1: Revert `create_task` to Pure Task Creation

Status: done

## Story

As a developer and learner using the MCP server,
I want `create_task` to create tasks exactly as specified without attempting sampling enrichment,
So that the tool behaves predictably and sampling is only used when explicitly requested via the new `create_task_using_sampling` tool introduced in Story 7.2.

## Acceptance Criteria

1. **AC1 — `create_task` no longer calls `server.createMessage()`**
   Given a client calls `create_task` with a title and description
   When the server executes the tool
   Then no call to `server.createMessage()` is made
   And the task is created with exactly the values provided by the caller

2. **AC2 — Response format is clean and simple**
   Given a client calls `create_task` with a title and description
   When the tool succeeds
   Then the response text is `Created task {id}: {title}` with no enrichment annotation
   And no mention of "enriched by AI" appears

3. **AC3 — No sampling dependency**
   Given a client calls `create_task` when Ollama is unavailable or the client does not support sampling
   When the server executes the tool
   Then the task is created successfully — there is no sampling dependency whatsoever

4. **AC4 — Enrichment module is retained**
   Given `src/enrichment.ts` and `src/enrichment.test.ts` exist
   When this story is implemented
   Then both files are left completely untouched
   And all existing enrichment unit tests continue to pass

5. **AC5 — No other tool behavior changes**
   Given any other tool (`update_task`, `update_task_status`, `get_task`, `delete_task`)
   When those tools execute
   Then behavior is identical to before this story

6. **AC6 — Server build is clean**
   Given the changes are applied
   When `npm run build` runs in the repo root
   Then TypeScript reports zero errors

## Tasks / Subtasks

- [x] Task 1: Remove sampling enrichment from `create_task` in `src/index.ts` (AC: #1, #2, #3)
  - [x] 1.1 In the `create_task` case of the `CallToolRequestSchema` handler, remove the `enrichmentPrompt` string
  - [x] 1.2 Remove the `original` snapshot object (`title`, `description`, `priority`, `dueDate` captured before enrichment)
  - [x] 1.3 Remove the `enrichmentResult` variable and the `Promise.race([server.createMessage(...), timeout])` block including its try/catch
  - [x] 1.4 Remove the `ENRICHMENT_TIMEOUT_MS` constant (top of file) if it is no longer referenced elsewhere — check first
  - [x] 1.5 Simplify the response text to `Created task ${id}: ${newTask.title}` with no conditional enrichment annotation
  - [x] 1.6 Ensure the `applyEnrichment` import from `./enrichment.js` is removed from `src/index.ts` if it is now unused — but leave `enrichment.ts` itself intact

- [x] Task 2: Verify `src/enrichment.ts` and tests are untouched (AC: #4)
  - [x] 2.1 Confirm `src/enrichment.ts` is unchanged
  - [x] 2.2 Run `npm test` — all enrichment tests in `src/enrichment.test.ts` still pass

- [x] Task 3: Build and regression check (AC: #5, #6)
  - [x] 3.1 `npm run build` — zero TypeScript errors
  - [x] 3.2 `npm test` — all existing tests pass (enrichment tests, proxy bridge tests, sampling handler tests)
  - [x] 3.3 Manually verify: start proxy + server, call `create_task` via curl or the UI — response is plain `Created task N: {title}` with no enrichment text
  - [x] 3.4 Manually verify: call `update_task`, `get_task`, `delete_task`, `update_task_status` — all behave identically to before

## Dev Notes

### What to change

This is a surgical removal, not a rewrite. The only file that changes is `src/index.ts`.

**Before (current `create_task` handler excerpt):**

```typescript
case "create_task": {
  // ... validation ...
  const newTask: Task = { /* ... */ };

  const original = {
    title: newTask.title,
    description: newTask.description,
    priority: newTask.priority,
    dueDate: newTask.dueDate,
  };

  let enrichmentResult = { enriched: false, changedFields: [] as string[] };
  try {
    const enrichmentPrompt = `You are enriching a task...`;
    const response = await Promise.race([
      server.createMessage({
        messages: [{ role: "user", content: { type: "text", text: enrichmentPrompt } }],
        maxTokens: 300,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Enrichment timed out")), ENRICHMENT_TIMEOUT_MS)
      ),
    ]);
    if (response.content.type === "text") {
      enrichmentResult = applyEnrichment(newTask, response.content.text);
    }
  } catch (err) {
    console.error("Sampling enrichment skipped:", ...);
  }

  tasks.set(id, newTask);

  let responseText = `Created task ${id}: ${newTask.title}`;
  if (enrichmentResult.enriched) {
    const changes = enrichmentResult.changedFields.map(...).join(", ");
    responseText += ` (enriched by AI — ${changes})`;
  }
  return { content: [{ type: "text", text: responseText }] };
}
```

**After (target state):**

```typescript
case "create_task": {
  // ... validation unchanged ...
  const newTask: Task = { /* ... same as before ... */ };

  tasks.set(id, newTask);

  return {
    content: [{ type: "text", text: `Created task ${id}: ${newTask.title}` }],
  };
}
```

### What NOT to touch

| File | Action |
|------|--------|
| `src/enrichment.ts` | **DO NOT TOUCH** — used by Story 7.2 |
| `src/enrichment.test.ts` | **DO NOT TOUCH** |
| `proxy/src/index.ts` | **DO NOT TOUCH** — the proxy still injects `sampling: {}` during initialize and still handles `sampling/createMessage` for other uses; this stays as-is until Story 7.3 |
| `proxy/src/sampling.ts` | **DO NOT TOUCH** |
| `proxy/src/spawnMcpServer.ts` | **DO NOT TOUCH** |
| `client/` | **DO NOT TOUCH** — no client changes in this story |
| Any other tool handler | **DO NOT TOUCH** |

### On the `ENRICHMENT_TIMEOUT_MS` constant

Check whether `ENRICHMENT_TIMEOUT_MS` at the top of `src/index.ts` is referenced anywhere other than the enrichment block. After removing the enrichment block from `create_task`, if the constant is unreferenced, remove it. If by some reason it is referenced elsewhere, leave it. It is not expected to be used elsewhere.

### On the `applyEnrichment` import

The import `import { applyEnrichment, VALID_PRIORITIES } from "./enrichment.js"` is at the top of `src/index.ts`. After this story:
- `applyEnrichment` is no longer called from `create_task` — remove it from the import
- `VALID_PRIORITIES` **is still used** in the `update_task` handler for priority validation — keep that import

So the import should become:
```typescript
import { VALID_PRIORITIES } from "./enrichment.js";
```

### Proxy still injects `sampling: {}`

Do not remove the sampling capability injection from the proxy's `initialize` handler. That injection is a prerequisite for Story 7.2's `create_task_using_sampling` tool, which will need sampling capability declared. Removing it now would require adding it back in 7.2 and risks confusion about what changed when.

### Previous Story Intelligence

From Story 6.1 (`done`):
- `server.createMessage(...)` was added to `create_task` in that story — this story directly reverts that addition
- The enrichment module (`src/enrichment.ts`) was extracted in 6.1 specifically so it could be reused — confirm it is reused as-is in 7.2, do not modify
- `ENRICHMENT_TIMEOUT_MS = 15_000` was the timeout constant set in 6.1 — remove it as part of this story (it will be reintroduced in 7.2 with a different name/value for the new tool)
- The proxy's `serverRequest` bridge machinery and `proxy/src/sampling.ts` were added in 6.1 — leave all of it intact

From Story 6.2 (`in-progress`):
- `client/src/lib/parseSamplingEnrichment.ts` was added to detect enrichment in the `create_task` response text — after this story, `create_task` will never produce enrichment text, so that parser will always return `null` for `create_task` calls
- The `ToolsPanel` in the client calls `parseSamplingEnrichment` for `create_task` and shows a fallback note if no enrichment is detected — this will now always show the fallback note for `create_task`, which is correct behaviour (the `samplingFallbackNote` copy handles this gracefully)
- No client changes are needed — the existing fallback path in 6.2's implementation handles the "no enrichment" case correctly

### Git Intelligence

Commit style: `feat(7.1): revert create_task to pure task creation`

Recent commits show all feature work uses `feat(X.Y): description` format. This story is a deliberate revert/simplification, not a new feature, but the `feat` prefix is consistent with the project's convention for story commits.

### Tech Stack Reference

| Item | Value |
|------|-------|
| File to modify | `src/index.ts` only |
| MCP SDK | `@modelcontextprotocol/sdk ^1.1.0` |
| Test runner | Vitest (`npm test` from repo root) |
| Build | `npm run build` from repo root (tsc) |

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (2026-04-02)

### Debug Log References

No issues encountered. Surgical removal was straightforward.

### Completion Notes List

- Removed `applyEnrichment` from import (kept `VALID_PRIORITIES` — still used by `update_task`)
- Removed `ENRICHMENT_TIMEOUT_MS = 15_000` constant (was only referenced in the enrichment block)
- Removed `original` snapshot, `enrichmentResult` variable, `enrichmentPrompt` string, and `Promise.race([server.createMessage(...), timeout])` try/catch block from `create_task`
- Simplified response to `Created task ${id}: ${newTask.title}` with no conditional annotation
- `src/enrichment.ts` and `src/enrichment.test.ts` left completely untouched
- `npm run build` — zero TypeScript errors ✅
- `npm test` — 12/12 tests pass ✅ (all enrichment tests pass)

### File List

- `src/index.ts` (modified)

### Change Log

- 2026-04-02: Removed sampling enrichment from `create_task`; simplified response text; removed `ENRICHMENT_TIMEOUT_MS` constant and `applyEnrichment` import. `enrichment.ts` and all tests untouched.
