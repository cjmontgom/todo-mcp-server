# Story 7.4: Proxy — Update System Prompt for Smart Ollama Tool Selection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner using the AI "Ollama is the MCP client" tab,
I want Ollama to automatically choose `create_task_using_sampling` when I give it a vague or underspecified task request,
So that I can see the sampling flow triggered naturally by the AI without explicitly asking for it.

## Acceptance Criteria

1. **AC1 — System prompt encodes explicit task-creation tool selection**
   Given the system prompt built in `proxy/src/llm.ts` (`buildSystemPrompt`)
   When this story is implemented
   Then the prompt includes explicit tool-selection guidance (plain English, impossible to miss):
   - Use **`create_task`** when the user provides a **clear title and description** (both materially present — the user has given enough detail to create a task without LLM enrichment).
   - Use **`create_task_using_sampling`** when the request is **vague**, **missing a meaningful description**, or would **benefit from enrichment** (e.g. `"add a task: fix the bug"`, `"create a task for the login issue"` — title-only or underspecified).
   - **Never** use `create_task_using_sampling` when the user has already provided **complete** task details (title + description and any other fields they specified).

2. **AC2 — Underspecified create flows through sampling tool and AI-mode trace**
   Given a learner types **"add a task: fix the login bug"** in the AI chat (Ollama running, proxy in default configuration)
   When Ollama interprets the request via `/llm/interpret`
   Then the structured operation is a **`tool_call`** with **`name`: `create_task_using_sampling`** and arguments consistent with the utterance (at minimum `{ "title": "fix the login bug" }` or equivalent — description omitted or empty)
   And the proxy routes sampling in **AI mode** (Story 7.3 — no change in this story)
   And **`sampling-trace`** SSE events are emitted as in Story 7.3

3. **AC3 — Fully specified create uses plain `create_task` (no sampling)**
   Given a learner types **"create a task titled 'Update README' with description 'Add setup instructions for Windows users', priority high"**
   When Ollama interprets the request
   Then the structured operation is a **`tool_call`** with **`name`: `create_task`** and arguments capturing title, description, and priority per the tool schema
   And **`create_task_using_sampling`** is **not** selected

4. **AC4 — Build and existing automated tests pass**
   Given all changes are applied
   When `npm run build` runs inside `proxy/`
   Then TypeScript reports zero errors
   And `npm test` in `proxy/` passes (all existing tests, including `handleSamplingRequest` and `index` tests — unchanged behavior)

## Tasks / Subtasks

- [x] Task 1: Extend `buildSystemPrompt` in `proxy/src/llm.ts` (AC: #1)
  - [x] 1.1 Add a dedicated section **after** the capability lists (RESOURCES / TOOLS / PROMPTS) and **before** the `Respond ONLY with a JSON object` block — e.g. a **"Task creation — which tool?"** heading and bullet rules matching AC1 verbatim intent (use exact tool names `create_task` and `create_task_using_sampling`).
  - [x] 1.2 Keep existing instructions (JSON shape, `resource_read` / `tool_call` / `prompt_get` / `none`, conversation history, out-of-scope requests) — do not regress Story 5.x behavior for non-task flows.
  - [x] 1.3 Do not duplicate full JSON schemas in prose; the TOOLS section already embeds `inputSchema` from the server. The new text is **selection policy** , not schema replacement.

- [x] Task 2: Verify behavior manually or via tests (AC: #2, #3)
  - [x] 2.1 **Manual (required for AC2–AC3):** Run proxy + MCP server + Ollama; use the AI tab with the two example phrases from the epic. Document outcomes in Dev Agent Record. *Note: Small models may occasionally misfire; `temperature: 0.1` (already set in `interpretWithLlm`) improves consistency. If a model repeatedly violates the prompt, note the model name in completion notes.*
  - [x] 2.2 **Optional regression lock:** Export `buildSystemPrompt` (or add a small test-only internal export pattern) and add `proxy/src/llm.test.ts` with Vitest asserting the prompt string contains the tool names and key selection phrases. *Not required by epic AC but prevents accidental deletion of the guidance.*

- [x] Task 3: Build and test (AC: #4)
  - [x] 3.1 `cd proxy && npm run build` — zero errors
  - [x] 3.2 `cd proxy && npm test` — all tests green

## Dev Notes

### Architecture compliance

- **LLM integration:** System prompt is built in `proxy/src/llm.ts`; `interpretWithLlm` uses OpenAI-compatible `POST .../v1/chat/completions` with `LLM_BASE_URL`, `LLM_MODEL`, optional `LLM_API_KEY` — [Source: `_bmad-output/planning-artifacts/architecture.md` — LLM endpoint]
- **Endpoint-based routing (Epic 7):** `POST /llm/interpret` already sets `currentSamplingMode = "ai"` before tool-call `bridge.send` (Story 7.3). This story **only** changes what tool Ollama picks; **no** changes to `proxy/src/index.ts` routing, SSE shapes, or `/mcp/sampling/respond`.

### Project structure — files to touch / not touch

| File | Action |
|------|--------|
| `proxy/src/llm.ts` | **Modify** — extend `buildSystemPrompt` only (unless optional Task 2.2 exports a helper). |

| File | Do **NOT** modify |
|------|---------------------|
| `proxy/src/index.ts` | Routing and mode flags are Story 7.3; out of scope here. |
| `proxy/src/sampling.ts` | Ollama fulfillment for sampling; unchanged. |
| `src/index.ts` (MCP server) | Tool definitions come from server; selection logic is client-side prompt only. |
| `client/` | Stories 7.5 / 7.6 |

### Implementation hints

- **Current prompt baseline:** See `buildSystemPrompt` in `proxy/src/llm.ts` — it lists resources, tools (with schemas), prompts, then JSON output contract. Insert the new task-tool section in the gap before line 59 (`Respond ONLY with a JSON object...`).
- **Naming:** Tool strings must match MCP exactly: `create_task`, `create_task_using_sampling` (as registered in `tools/list` from the server).
- **Edge cases to reflect in prose:** Title-only requests → sampling tool; user gives long description + title → `create_task`; user says "add task X" with no further detail → sampling tool.

### Testing standards

- **Automated:** `proxy` uses Vitest (`npm test`). No `llm.test.ts` exists today — optional addition per Task 2.2.
- **Manual:** Required for AC2–AC3 due to real LLM behavior.

### References

- Epic 7 / Story 7.4 requirements: `_bmad-output/planning-artifacts/epics.md` (Story 7.4, FR37)
- Previous story (routing + SSE): `_bmad-output/implementation-artifacts/7-3-proxy-endpoint-based-sampling-routing-sse-events-and-human-response-endpoint.md`
- Server tool behavior: `_bmad-output/implementation-artifacts/7-2-add-create-task-using-sampling-tool-to-server.md`

### Previous story intelligence (7.3)

- Story 7.4 was explicitly called out in 7.3 Dev Notes: **Updates `proxy/src/llm.ts` system prompt** so Ollama auto-selects `create_task_using_sampling` for underspecified tasks; **no proxy routing changes in 7.4**.
- AI-mode trace events (`sampling-trace`) already fire when `create_task_using_sampling` runs from `/llm/interpret`; this story makes that path reachable via natural language.

### Git intelligence (recent pattern)

- Recent epic 7 commits: `feat(7.1)` server, `feat(7.2)` sampling tool, `feat(7.3)` proxy routing — follow same Conventional Commit style for 7.4, e.g. `feat(7.4): prompt Ollama to prefer sampling tool for underspecified tasks`.

### Latest tech notes

- Ollama exposes OpenAI-compatible chat at `${LLM_BASE_URL}/v1/chat/completions` — already used in `interpretWithLlm`. No dependency version change required for this story.

### Project context reference

- No `project-context.md` found in repo; use this story + architecture + epics as authority.

## Dev Agent Record

### Agent Model Used

Composer (dev-story 7.4)

### Debug Log References

### Completion Notes List

- Extended `buildSystemPrompt` in `proxy/src/llm.ts` with a **Task creation — which tool?** block after PROMPTS and before the JSON output contract: use `create_task` when title and description are materially present; use `create_task_using_sampling` for vague/title-only/underspecified creates; never use sampling when the user already gave complete task details.
- Exported `buildSystemPrompt` for tests; added `proxy/src/llm.test.ts` (Vitest) to lock tool names and key selection phrases in the prompt string.
- **Manual AC2–AC3:** Marked complete per user request when finalizing Story 7.4. If needed, re-run manual verification with proxy + MCP + Ollama: (1) *"add a task: fix the login bug"* → `tool_call` `create_task_using_sampling` with at least `{ "title": "fix the login bug" }` and AI-mode sampling trace; (2) *"create a task titled 'Update README' with description 'Add setup instructions for Windows users', priority high"* → `create_task` with those fields — not `create_task_using_sampling`. Note model name if behavior is inconsistent at `temperature: 0.1`.

### File List

- `proxy/src/llm.ts`
- `proxy/src/llm.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/7-4-proxy-update-system-prompt-for-smart-ollama-tool-selection.md`

## Change Log

- 2026-04-02: Story 7.4 — system prompt task-tool selection; `buildSystemPrompt` export; `llm.test.ts` regression test.
- 2026-04-02: Story 7.4 marked done and moved to completed state.

## Story completion status

- **Status:** done
- **Note:** Story finalized and marked complete on 2026-04-02.

---

### Open questions / clarifications (non-blocking)

- If manual testing shows a specific Ollama model ignoring selection rules, consider tightening prompt wording or listing few-shot examples in a follow-up — out of scope unless AC2/AC3 cannot be met with `llama3.1` at `temperature: 0.1`.
