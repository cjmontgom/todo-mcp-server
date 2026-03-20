# Sprint Change Proposal — 2026-03-19

**Project:** todo-mcp-server  
**Author:** chloe  
**Date:** 2026-03-19  
**Change Scope:** Moderate  

---

## Section 1: Issue Summary

**Trigger:** New requirement from stakeholder (chloe) during sprint execution.

**Problem Statement:** The current plan (Epic 4) provides a manual, panel-based UI for exploring MCP capabilities. The user wants to add an LLM-powered natural language interface where learners can type plain-English requests (e.g. "show me overdue tasks sorted by priority") and watch an AI interpret the request, select the appropriate MCP operation, execute it, and display results — demonstrating how AI agents interact with MCP servers under the hood.

**Discovery Context:** Identified during create-story workflow for Story 1.2. The feature deepens the educational value of the project by showing the AI-to-MCP interaction pattern that tools like Claude Desktop and Cursor use internally.

**LLM Provider Decision:** Ollama (local, free, no API key) as default. Uses the OpenAI-compatible `/v1/chat/completions` API — configurable to swap in cloud providers (Anthropic, OpenAI) via env vars if desired.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Detail |
|------|--------|--------|
| Epic 1 (Task Management) | None | Server stories unaffected |
| Epic 2 (Prompts) | None | Prompts stories unaffected |
| Epic 3 (Proxy) | Minor | Proxy gains an LLM endpoint (`POST /llm/interpret`) in Epic 5; proxy core implementation (Epic 3) unchanged |
| Epic 4 (React + AG Grid) | None | All 5 stories unchanged; manual UI delivers full value independently |
| **Epic 5 (NEW)** | **Added** | 2 new stories for LLM-powered natural language MCP interaction |

### Artifact Impact

| Artifact | Changes Needed |
|----------|---------------|
| PRD | Add FR29–FR32, SC7, MVP scope line, NFR note |
| Architecture | Add LLM endpoint pattern, ChatPanel component, proxy env vars, integration flow |
| Epics | Add Epic 5 with 2 stories, FR coverage map entries, UX-DR10–13 |
| Sprint Status | Add Epic 5 entries (epic-5, 5-1, 5-2) |

### Technical Impact

- **New dependency:** Ollama running locally (no npm packages — uses `fetch`)
- **Proxy changes:** New `POST /llm/interpret` endpoint + LLM module (`proxy/src/llm.ts`)
- **Client changes:** New `ChatPanel.tsx` component
- **Env vars:** `LLM_BASE_URL`, `LLM_MODEL`, optional `LLM_API_KEY`
- **No breaking changes** to any existing code or behavior

---

## Section 3: Recommended Approach

**Selected path:** Direct Adjustment — add Epic 5 with 2 new stories.

**Rationale:**
1. Additive change — zero impact on Epics 1–4
2. Natural dependency chain: Epic 5 builds on Epic 3 (proxy) and Epic 4 (React + AG Grid)
3. Clean learning progression: manual MCP exploration (Epic 4) → AI-mediated MCP (Epic 5)
4. Low risk — if LLM integration hits issues, the entire manual UI ships regardless

**Effort estimate:** Medium (2 stories, proxy endpoint + React component)  
**Risk level:** Low (additive, isolated, no breaking changes)  
**Timeline impact:** Adds ~2 stories to the backlog after Epic 4; no impact on Epics 1–3 timeline

---

## Section 4: Detailed Change Proposals

### 4.1 PRD Changes

**Add to Functional Requirements — new section after "React app – AG Grid and polish":**

```
### Natural language MCP interaction (LLM)

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FR29 | The React app includes a chat interface where users type natural language requests about tasks. | A text input and conversation area are visible; user can type requests like "show me overdue tasks sorted by priority." |
| FR30 | An LLM endpoint on the proxy accepts user text plus available MCP capability descriptions and returns a structured intent (which MCP operation to call, with what arguments, and a human-readable explanation). | Proxy exposes an endpoint (e.g. `POST /llm/interpret`); calls a configurable LLM provider (Ollama at `http://localhost:11434` by default); `LLM_BASE_URL` and `LLM_MODEL` env vars on proxy. |
| FR31 | The app executes the LLM-selected MCP operation and displays results in AG Grid, with educational copy explaining which MCP capability was used. | After LLM interpretation, the app calls the corresponding MCP method and shows results in the grid with a note like "The AI read resource task://table/by-priority to answer your question." |
| FR32 | The chat interface maintains conversation history within the session and supports multi-turn context. | Prior messages are visible; the LLM receives conversation context so follow-up requests like "now sort those by deadline instead" work. |
```

**Add to Success Criteria table:**

```
| SC7 | User understands how AI agents use MCP | User can type a plain-language request, see the AI select and execute an MCP operation, and read an explanation of what capability was used and why. |
```

**Add to Scope — MVP:**

```
- **LLM integration:** Chat interface in React app; proxy-side LLM endpoint that interprets natural language and maps to MCP operations; results in AG Grid with educational explanation of what the AI did. Ollama (local) as default LLM provider.
```

### 4.2 Architecture Changes

**API & Communication Patterns — replace existing section with:**

```
- **Protocol:** MCP over JSON-RPC. Server: STDIO only. Browser: HTTP + SSE to proxy; proxy forwards to server over STDIO.
- **Proxy:** Single Node process; spawns MCP server; exposes HTTP endpoints + SSE for MCP messages; forwards requests/responses transparently.
- **LLM endpoint:** Proxy exposes `POST /llm/interpret` — accepts `{ message: string, history: Message[], capabilities: Capabilities }`. Proxy calls a configurable LLM via OpenAI-compatible chat API (Ollama at `http://localhost:11434` by default; swap to Anthropic/OpenAI by changing `LLM_BASE_URL` and `LLM_MODEL`). No vendor SDK — uses `fetch` against the OpenAI-compatible `/v1/chat/completions` endpoint that Ollama exposes natively. Returns `{ explanation: string, operation: { type: "resource_read" | "tool_call" | "prompt_get", params: object } }`. The proxy then executes the MCP operation and returns both the explanation and the MCP result. Env vars: `LLM_BASE_URL` (default `http://localhost:11434`), `LLM_MODEL` (default `llama3.1`). No API key required for Ollama; optional `LLM_API_KEY` for cloud providers.
- **Error handling:** MCP error responses passed through proxy; React app surfaces errors in UI. LLM errors (provider unreachable, invalid response) surfaced as user-visible messages in the chat UI. No custom rate limiting for MVP.
```

**Frontend Architecture — Components:**

```
- **Components:** Sections for Resources, Tools, Prompts; shared AG Grid component (or wrapper) for tabular data; forms driven by tool/prompt schemas. Chat panel component (`ChatPanel.tsx`) with text input, conversation history, and result display area that reuses the shared AG Grid component.
```

**Project Structure — client/src/components/:**

```
        ├── components/
        │   ├── ResourcesPanel.tsx
        │   ├── ToolsPanel.tsx
        │   ├── PromptsPanel.tsx
        │   ├── TaskGrid.tsx
        │   └── ChatPanel.tsx
```

**Requirements to Structure Mapping — add:**

```
| Epic 5 — LLM endpoint | `proxy/src/llm.ts` (or `proxy/src/llmEndpoint.ts`) |
| Epic 5 — Chat UI | `client/src/components/ChatPanel.tsx` |
```

**Integration Points — add:**

```
**LLM chain:** Client `ChatPanel` → `POST /llm/interpret` on proxy → proxy calls LLM (Ollama default) → LLM returns structured intent → proxy executes MCP operation → returns explanation + MCP result → client renders in AG Grid with educational note.
```

### 4.3 Epics Changes

**Add UX Design Requirements (after UX-DR9):**

```
UX-DR10: Chat panel with persistent text input and scrollable conversation history; user messages right-aligned, AI responses left-aligned with explanation text and optional AG Grid result below.
UX-DR11: After the LLM executes an MCP operation, a brief educational note appears in the chat response explaining which MCP capability was used.
UX-DR12: Loading state visible in the chat panel while the LLM is processing; input disabled during processing.
UX-DR13: LLM or MCP errors surfaced inline in the chat conversation as error messages, not silent failures.
```

**Add FR Coverage Map entries:**

```
| FR29 | Epic 5 | Chat interface for natural language |
| FR30 | Epic 5 | LLM endpoint on proxy (Ollama default) |
| FR31 | Epic 5 | Execute LLM-selected MCP operation, display in grid |
| FR32 | Epic 5 | Multi-turn conversation history |
```

**Add Epic 5 definition and stories** (full text in approved proposals above — Epic overview, Story 5.1, Story 5.2 with all BDD acceptance criteria).

### 4.4 Sprint Status Changes

**Add to development_status:**

```yaml
  # ── Epic 5: Natural Language MCP Interaction via LLM ──
  epic-5: backlog
  5-1-add-llm-interpretation-endpoint-and-chat-ui: backlog
  5-2-multi-turn-conversation-and-educational-integration: backlog
  epic-5-retrospective: optional
```

---

## Section 5: Implementation Handoff

**Change scope:** Moderate — new epic with 2 stories, updates to 3 planning documents + sprint status.

**Handoff plan:**

| Role | Responsibility |
|------|---------------|
| SM (current) | Apply approved changes to PRD, architecture, epics, sprint status |
| Dev team | Implement Epics 1–4 as planned; Epic 5 after Epic 4 completion |
| PM (optional) | Review updated PRD if deeper product validation desired |

**Success criteria:**
1. All 4 planning artifacts updated with approved changes
2. Sprint status reflects Epic 5 with 2 backlog stories
3. Epics 1–4 continue unmodified
4. Epic 5 stories are implementable after Epic 4 completion

**Prerequisites for Epic 5 implementation:**
- Ollama installed locally (`brew install ollama`)
- A model pulled (`ollama pull llama3.1`)
- Epic 3 (proxy) and Epic 4 (React app) completed
