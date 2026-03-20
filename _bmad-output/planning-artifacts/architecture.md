---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['prd.md', 'mcp_task_manager_extension.plan.md']
workflowType: 'architecture'
project_name: 'todo-mcp-server'
user_name: 'chloe'
date: '2026-03-17'
lastStep: 8
status: complete
completedAt: '2026-03-17'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- **MCP server:** Task model with optional `dueDate`; `create_task` and `update_task`; markdown-table resources (`task://table/*`, `task://open`) and existing JSON/summary resources; prompts capability with `tasks_table`, `tasks_summary_for_stakeholders`, `completions_by_date`. Server remains STDIO-only.
- **Proxy:** Single process that spawns the task-manager server over STDIO and exposes HTTP/SSE (or WebSocket) to the browser; forwards MCP JSON-RPC. No change to server STDIO for existing clients.
- **React app:** Connect to proxy; list/read Resources and list/call Tools and list/get Prompts with schema- or argument-based forms; present tabular data primarily in AG Grid (parse JSON and markdown tables); consistent MCP terminology and short educational copy after key actions.

**Non-Functional Requirements:**
- **Educational first:** UI teaches MCP concepts; each of Resources, Tools, and Prompts has explanatory copy and post-action explanations.
- **Compatibility:** Existing Claude Desktop and Cursor usage via STDIO unchanged; all new behaviour additive.
- **AG Grid first:** Tabular data from any source (resources, tools, prompts) shown in AG Grid by default; markdown/Mermaid only as fallback.
- **Tech stack:** React front-end; AG Grid as primary data-presentation layer; MCP client over HTTP/SSE (or WebSocket) to proxy; server and proxy TypeScript/Node.

**Scale & Complexity:**
- Primary domain: Full-stack (Node/TS MCP server, Node/TS proxy, React SPA).
- Complexity level: Low–medium.
- Estimated architectural components: Three — MCP server, proxy, React app.

### Technical Constraints & Dependencies

- Server must keep single STDIO transport; proxy is the only path for browser clients.
- MCP SDK types and JSON-RPC semantics govern server and client; proxy is transparent forwarder.
- AG Grid drives client-side presentation for any tabular data; client must parse both `application/json` (task arrays) and `text/markdown` (tables) into grid rows.
- Existing `task://all`, `task://summary`, and current tools remain; new resources and prompts are additive.

### Cross-Cutting Concerns Identified

- **Transport:** STDIO for desktop clients vs HTTP/SSE (or WebSocket) for browser; proxy design and lifecycle (spawn, forward, reconnect).
- **Tabular data pipeline:** Server-side `Task[]` → markdown table helper; client-side parsing (JSON or markdown) → AG Grid; consistent column set (ID, Title, Description, Status, Priority, Due, Created).
- **Educational consistency:** MCP terms (Resource, Tool, Prompt, List, Read, Call, Invoke) and in-app explanations applied uniformly across Resources, Tools, and Prompts sections.

## Starter Template Evaluation

### Primary Technology Domain

**React SPA** (new educational MCP client). The MCP server and proxy remain TypeScript/Node; the only greenfield surface is the React app, so the starter applies there.

### Starter Options Considered

- **Vite `react-ts` (official):** Default choice — official template, TypeScript, fast HMR, minimal. AG Grid and MCP client are added in implementation. Recommended by React and used in AG Grid examples.
- **Create React App:** Legacy option; heavier and no longer recommended for new projects.
- **Next.js:** Overkill for a single SPA that talks only to the proxy; no SSR requirement.
- **Third-party React+TS+Vite starters:** Optional extras (Tailwind, etc.) not required for MVP; can be added later if desired.

### Selected Starter: Vite (react-ts template)

**Rationale for Selection:**
- Aligns with PRD/plan: React, TypeScript, simple front-end.
- Official, well-maintained, and works with AG Grid (documented setup).
- Keeps the foundation minimal so the first story can add AG Grid, MCP client, and educational UI without fighting the template.
- Server and proxy are not starter-based: server is the existing codebase; proxy is a small Node/TS process (e.g. Express or native HTTP + SSE).

**Initialization Command:**

```bash
npm create vite@latest <react-app-name> -- --template react-ts
cd <react-app-name>
npm install
# Then add AG Grid and MCP client deps in first implementation story:
# npm install ag-grid-react ag-grid-community
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript with strict-friendly defaults; ESM; Node for tooling.

**Styling Solution:**
- Plain CSS by default; add Tailwind or another approach in implementation if needed.

**Build Tooling:**
- Vite: fast dev server, HMR, Rollup-based production build, `vite.config.ts`.

**Testing Framework:**
- Not included; add Vitest/React Testing Library in a later story if desired.

**Code Organization:**
- `src/` with `main.tsx`, `App.tsx`, `vite-env.d.ts`; clear place for components, hooks, and MCP client code.

**Development Experience:**
- `npm run dev` for dev server; `npm run build` for production; path aliases configurable in Vite. Production preview not required for this project.

**Note:** Project initialization using this command should be the first implementation story for the React app (Epic 4). The MCP server and proxy do not use a separate starter.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Proxy transport: HTTP + SSE (browser ↔ proxy). Enables MCP JSON-RPC request/response and streaming without WebSocket complexity.
- AG Grid: Community edition. Sufficient for learning and tabular display; no Enterprise dependency.
- Tabular data pipeline: Server exposes `Task[]` as markdown table via shared helper; client parses markdown tables (and JSON) into row arrays for AG Grid (minimal parser or small library per implementation story).

**Important Decisions (Shape Architecture):**
- React app state: Use React Context for proxy connection and "current result" (last read/call/invoke); local component state elsewhere. Keeps educational UI simple and avoids a global store for MVP.
- MCP client: Use MCP SDK or equivalent JSON-RPC client in the browser, configured with proxy base URL (e.g. `http://localhost:3xxx`). No custom protocol layer beyond SDK.

**Deferred Decisions (Post-MVP):**
- Authentication / security: N/A for local/dev MVP.
- Database / persistence: Server keeps current in-memory persistence; no change for MVP.
- Infrastructure / deployment: Out of scope for MVP; production preview not required.
- Styling: Plain CSS from Vite template; Tailwind or design system can be added later if desired.

### Data Architecture

- **Server:** In-memory task store (existing); Task model extended with optional `dueDate`. No database or migration.
- **Tabular representation:** Shared server helper: `Task[]` → markdown table (consistent columns). Client: parse markdown table (and JSON task arrays) into row objects for AG Grid.

### Authentication & Security

- **MVP:** None. Local development only; proxy and app run on localhost. No auth or encryption decisions for current scope.

### API & Communication Patterns

- **Protocol:** MCP over JSON-RPC. Server: STDIO only. Browser: HTTP + SSE to proxy; proxy forwards to server over STDIO.
- **Proxy:** Single Node process; spawns MCP server; exposes HTTP endpoints + SSE for MCP messages; forwards requests/responses transparently. Exact API surface (e.g. POST for JSON-RPC, SSE for streaming) to be fixed in proxy implementation story.
- **LLM endpoint:** Proxy exposes `POST /llm/interpret` — accepts `{ message: string, history: Message[], capabilities: Capabilities }`. Proxy calls a configurable LLM via OpenAI-compatible chat API (Ollama at `http://localhost:11434` by default; swap to Anthropic/OpenAI by changing `LLM_BASE_URL` and `LLM_MODEL`). No vendor SDK — uses `fetch` against the OpenAI-compatible `/v1/chat/completions` endpoint that Ollama exposes natively. Returns `{ explanation: string, operation: { type: "resource_read" | "tool_call" | "prompt_get", params: object } }`. The proxy then executes the MCP operation and returns both the explanation and the MCP result. Env vars: `LLM_BASE_URL` (default `http://localhost:11434`), `LLM_MODEL` (default `llama3.1`). No API key required for Ollama; optional `LLM_API_KEY` for cloud providers.
- **Error handling:** MCP error responses passed through proxy; React app surfaces errors in UI (e.g. toast or inline message). LLM errors (provider unreachable, invalid response) surfaced as user-visible messages in the chat UI. No custom rate limiting for MVP.

### Frontend Architecture

- **State:** Context for MCP connection and current result; local state for forms, selected resource/tool/prompt, and UI toggles. No Redux or global store for MVP.
- **Components:** Sections for Resources, Tools, Prompts; shared AG Grid component (or wrapper) for tabular data; forms driven by tool/prompt schemas. Chat panel component (`ChatPanel.tsx`) with text input, conversation history, and result display area that reuses the shared AG Grid component.
- **Routing:** Minimal (e.g. single page with sections or simple tabs). No deep routing required for MVP.
- **Data flow:** List → user selects → Read/Call/Invoke → result (and optional refresh); tabular results rendered in AG Grid by default.

### Infrastructure & Deployment

- **MVP:** Local development only. `npm run dev` for React app; proxy and server run locally. No hosting, CI/CD, or monitoring decisions for current scope.

### Decision Impact Analysis

**Implementation sequence (aligns with epics):**
1. Server: Task model + tools + markdown resources + prompts (shared table helper).
2. Proxy: HTTP + SSE, spawn server, forward MCP JSON-RPC.
3. React app: Vite scaffold → add AG Grid + MCP client → Context + Resources/Tools/Prompts sections + grid for tabular data + educational copy.
4. LLM integration: Proxy LLM endpoint + React ChatPanel → natural language → MCP operations → AG Grid results.

**Cross-component dependencies:**
- Proxy depends on server STDIO contract (unchanged).
- React app depends on proxy URL and MCP JSON-RPC over HTTP/SSE; AG Grid column set should match server table columns (ID, Title, Description, Status, Priority, Due, Created).

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points:** ~8 areas (naming, repo layout, dates, MCP vs app types, error UI, grid columns, educational copy hooks).

### Naming Patterns

**Database naming:** N/A (in-memory only).

**API / proxy naming:**
- Proxy HTTP routes: use clear, documented paths (e.g. `POST /mcp` or `/rpc` for JSON-RPC); document in README. Prefer lowercase path segments with hyphens if multiple segments (e.g. `/mcp/message`).
- Environment variable for React app: `VITE_MCP_PROXY_URL` (Vite convention for client-exposed config).
- Proxy LLM env vars: `LLM_BASE_URL` (default `http://localhost:11434`), `LLM_MODEL` (default `llama3.1`), optional `LLM_API_KEY` (empty for Ollama).

**Code naming (TypeScript / React):**
- React components: **PascalCase** (`ResourcesPanel.tsx`, `TaskGrid.tsx`).
- Hooks: **camelCase** with `use` prefix (`useMcpClient.ts`).
- Server/proxy modules: **camelCase** files for logic (`spawnServer.ts`); entry points `index.ts` where conventional.
- MCP tool and resource URIs: **match PRD exactly** (`task://table/by-deadline`, `create_task`, etc.); do not rename for "style."
- Task fields in code: **camelCase** (`dueDate`, `createdAt`) aligned with existing `Task` type.

### Structure Patterns

**Repository layout (recommended):**
- Existing MCP server: root `src/` (or current layout); keep extending `src/index.ts` or split handlers only if a story explicitly refactors.
- Proxy: new top-level folder e.g. `proxy/` with own `package.json` or workspace package; entry `src/index.ts` or `src/server.ts`.
- React app: new folder e.g. `client/` or `web/` with Vite scaffold; `src/components/`, `src/context/`, `src/mcp/`, `src/lib/` (parsers, column defs).

**Tests:** Co-locate `*.test.ts` next to source for proxy/server utils; Vitest in `client/` when added. No mandatory test layout for MVP beyond consistency within each package.

**Config:** Each package has its own `tsconfig.json`; root may use npm workspaces optional.

### Format Patterns

**Dates:** `dueDate` and API-facing task dates as **ISO 8601 strings** (e.g. `2026-03-17` or full datetime). Display in UI with `toLocaleString()` or consistent formatter in one helper.

**JSON:** **camelCase** in TypeScript types and client payloads. MCP protocol messages follow MCP SDK shapes (do not rename JSON-RPC keys).

**Markdown tables (server):** Stable column order: ID, Title, Priority, Due, Status (extend with Description, Created where PRD lists them); pipe-separated header row; align with AG Grid column defs on client.

**Errors:** MCP `error` object with `code` and `message`; proxy forwards unchanged. React: show `message` to user; log full payload in dev only.

### Communication Patterns

**Context (React):** Immutable updates only (new object references). One primary context for MCP client + connection state + last error; avoid duplicating server state in multiple contexts.

**Educational copy:** Centralize short strings in a module e.g. `src/copy/mcpExplainer.ts` or constants object so terminology stays consistent (Resource, Tool, Prompt, Read, Call, Invoke).

### Process Patterns

**Loading:** Per-section or per-action `isLoading` boolean (or `idle | loading | error`) on the component or context slice that triggered the MCP call.

**After mutating tools:** Optional refresh of selected resource or show fixed educational note; pattern: call success → set flag or message key → user sees "You used a Tool…"

### Enforcement Guidelines

**All AI agents MUST:**
- Preserve existing STDIO MCP behaviour and URI/tool names from the PRD.
- Use camelCase for Task and TypeScript APIs; PascalCase for React components.
- Put new packages in `proxy/` and `client/` (or names agreed in project structure step) without mixing proxy code into `src/index.ts` server file.
- Route tabular data through the shared AG Grid wrapper and shared column-def helper when displaying tasks.

**Pattern enforcement:** Code review / story acceptance checks naming and folder placement; update this doc if layout changes.

### Pattern Examples

**Good:** `client/src/components/TaskGrid.tsx` + `client/src/lib/taskColumns.ts` + `dueDate: "2026-03-17"`.

**Anti-patterns:** Renaming `task://table/all`; snake_case Task fields in TS; embedding proxy inside React app; multiple conflicting markdown table column orders between server and client.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
todo-mcp-server/
├── README.md
├── package.json                 # MCP server package (existing)
├── tsconfig.json
├── .gitignore
├── mcp_task_manager_extension.plan.md
├── LEARNING_PATHWAY.md
├── _bmad-output/
├── src/
│   └── index.ts                 # MCP server entry: tools, resources, prompts (extend here or split in later refactor)
├── build/                       # Compiled server output (existing)
│
├── proxy/                       # NEW: HTTP+SSE → STDIO bridge
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── src/
│       ├── index.ts             # HTTP server, spawn MCP child, forward JSON-RPC
│       └── spawnMcpServer.ts    # optional: child process + stdio pipes
│
└── client/                      # NEW: Vite React app
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── .env.example             # VITE_MCP_PROXY_URL=http://localhost:3xxx
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── vite-env.d.ts
        ├── context/
        │   └── McpContext.tsx
        ├── mcp/
        │   └── client.ts        # JSON-RPC / MCP calls to proxy
        ├── components/
        │   ├── ResourcesPanel.tsx
        │   ├── ToolsPanel.tsx
        │   ├── PromptsPanel.tsx
        │   ├── TaskGrid.tsx
        │   └── ChatPanel.tsx
        ├── lib/
        │   ├── taskColumns.ts   # AG Grid column defs
        │   └── parseMarkdownTable.ts
        └── copy/
            └── mcpExplainer.ts
```

*(Optional later: root `package.json` workspaces to `npm run dev:all`; tests co-located as `*.test.ts` when added.)*

### Architectural Boundaries

**API boundaries:**
- **Browser ↔ Proxy:** HTTP + SSE only; JSON-RPC MCP messages. No direct browser ↔ MCP STDIO.
- **Proxy ↔ Server:** Child process STDIO only; same MCP server binary as Claude/Cursor (`node build/index.js` or equivalent).
- **Desktop ↔ Server:** Unchanged STDIO (no proxy).

**Component boundaries:**
- **Server:** Owns task store, resource URIs, tools, prompts. No HTTP.
- **Proxy:** Owns HTTP/SSE, process lifecycle, byte forwarding. No task domain logic.
- **Client:** Owns UI, AG Grid, forms from schemas, parsing for display. No task persistence.

**Data boundaries:**
- Single source of truth: server in-memory `Task[]`. Client is read-through + tool mutations via MCP only.

### Requirements to Structure Mapping

| Epic / area | Location |
|-------------|----------|
| Epic 1 — Task model, tools, markdown resources | `src/index.ts` (+ optional `src/markdownTable.ts`) |
| Epic 2 — Prompts | `src/index.ts` (prompts/list, prompts/get) |
| Epic 3 — Proxy | `proxy/src/*` |
| Epic 4 — React, AG Grid, education | `client/src/*` |
| Epic 5 — LLM endpoint | `proxy/src/llm.ts` (or `proxy/src/llmEndpoint.ts`) |
| Epic 5 — Chat UI | `client/src/components/ChatPanel.tsx` |

**Cross-cutting:** Shared task column semantics — server markdown helper + `client/src/lib/taskColumns.ts` must stay aligned.

### Integration Points

**Internal:** Client `mcp/client.ts` → proxy URL → proxy forwards → server JSON-RPC handlers.

**LLM chain:** Client `ChatPanel` → `POST /llm/interpret` on proxy → proxy calls LLM (Ollama default) → LLM returns structured intent → proxy executes MCP operation → returns explanation + MCP result → client renders in AG Grid with educational note.

**External:** `@modelcontextprotocol/sdk` on server; browser may use fetch + EventSource or thin MCP-aware client toward proxy.

**Data flow:** User action in client → MCP method → proxy → server → response → parse if tabular → AG Grid.

### File Organization Patterns

- **Config:** Per-package `tsconfig.json`; client env via `VITE_*`.
- **Source:** Feature panels under `client/src/components/`; MCP transport isolated in `client/src/mcp/`.
- **Tests:** Co-located when introduced.
- **Assets:** Vite `public/` if static assets are needed.

### Development Workflow Integration

- **Server:** `npm run build && node build/index.js` (STDIO) for desktop; proxy spawns this.
- **Proxy:** `cd proxy && npm run dev` (port e.g. 3001).
- **Client:** `cd client && npm run dev` (Vite, e.g. 5173).
- **Deployment:** MVP local-only; no deployment tree required.

## Architecture Validation Results

### Coherence Validation

**Decision compatibility:** TypeScript across packages; React + Vite + AG Grid Community on client; Node proxy spawning same server build as desktop MCP. No version conflicts identified at architecture level.

**Pattern consistency:** PascalCase components, camelCase Task fields, PRD-stable URIs, centralized copy module, and shared column semantics match stated decisions.

**Structure alignment:** Three-package layout (root server, `proxy/`, `client/`) matches transport boundaries and epic ownership.

### Requirements Coverage Validation

**Epic coverage:** Epics 1–2 → `src/`; Epic 3 → `proxy/`; Epic 4 → `client/`. Cross-epic dependency: proxy must run built server; client depends on proxy URL.

**Functional requirements:** FR1–FR13 (server), FR14–FR16 (proxy), FR17–FR28 (client) are each supported by an architectural home and the tabular/educational patterns.

**Non-functional requirements:** NFR1–NFR4 (educational, compatibility, AG Grid first, stack) are reflected in decisions and patterns.

### Implementation Readiness Validation

**Decision completeness:** Critical choices (transport, AG Grid edition, state shape, repo layout) are documented. Exact proxy endpoint contract is intentionally left to implementation story.

**Structure completeness:** Directory tree and integration points are specified; file names are suggestive, not exhaustive.

**Pattern completeness:** Naming, format, context, loading, and anti-patterns are documented for common agent conflicts.

### Gap Analysis Results

- **Important (non-blocking):** Define proxy request/response and SSE event format in the proxy story so client and proxy stay in sync.
- **Nice-to-have:** Root npm workspaces + `dev:all` script; Vitest in client; optional `src/markdownTable.ts` split from `index.ts` when server file grows.

### Validation Issues Addressed

No blocking issues. Open proxy API detail tracked as first task in Epic 3.

### Architecture Completeness Checklist

**Requirements analysis** — context, scale, constraints, cross-cutting: done.  
**Architectural decisions** — stack, integration, MVP scope: done.  
**Implementation patterns** — naming, structure, formats, process: done.  
**Project structure** — tree, boundaries, mapping: done.

### Architecture Readiness Assessment

**Overall status:** Ready for implementation.  
**Confidence level:** High for MVP scope; medium until proxy MCP wire format is specified in code/docs.

**Key strengths:** Clear three-way split; PRD traceability; AG Grid and educational goals baked into structure.  
**Areas for future enhancement:** Auth, persistence, deployment, production preview (explicitly out of scope).

### Implementation Handoff

**AI agent guidelines:** Follow this document for boundaries and patterns; do not break STDIO or existing resource/tool contracts.

**First implementation priority:** Epic 1 (server) per sprint plan, or scaffold `client/` with Vite per starter section if parallelizing; proxy after or alongside server extensions as preferred.
