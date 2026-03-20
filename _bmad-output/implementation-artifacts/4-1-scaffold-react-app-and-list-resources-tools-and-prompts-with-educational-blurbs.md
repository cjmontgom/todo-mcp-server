# Story 4.1: Scaffold React app and list Resources, Tools, and Prompts with educational blurbs

Status: done

## Story

As a learner opening the React app for the first time,
I want to see all server capabilities (Resources, Tools, Prompts) listed in three sections with educational explanations,
so that I immediately understand what each MCP capability type is before I interact with it.

## Acceptance Criteria

1. **AC1 — Vite scaffold boots without errors**
   Given a developer has scaffolded the React app with `npm create vite@latest client -- --template react-ts` and installed deps including `ag-grid-react ag-grid-community`
   When `cd client && npm run dev` is executed
   Then the app starts on `localhost:5173` (or configured port) without errors

2. **AC2 — Three capability sections populated from proxy**
   Given the app loads and `VITE_MCP_PROXY_URL` is set
   When the page renders
   Then the app calls `resources/list`, `tools/list`, and `prompts/list` via the proxy and displays results in three distinct sections labelled Resources, Tools, and Prompts

3. **AC3 — Resources section with educational blurb**
   Given the Resources section renders
   When the list is populated
   Then each resource shows its URI, name, and description; a visible blurb reads: "Resources are read-only data the server exposes by URI. Click a resource to Read it." (FR17, UX-DR1)

4. **AC4 — Tools section with educational blurb**
   Given the Tools section renders
   When the list is populated
   Then each tool shows its name, description, and a summary of its input schema; a visible blurb reads: "Tools are actions the client can invoke with arguments. Fill the form and Call a tool." (FR18, UX-DR1)

5. **AC5 — Prompts section with educational blurb**
   Given the Prompts section renders
   When the list is populated
   Then each prompt shows its name, description, and arguments; a visible blurb reads: "Prompts are pre-built messages the server returns. Invoke a prompt to get that content." (FR19, UX-DR1)

6. **AC6 — Error displayed when proxy unreachable**
   Given the proxy is unreachable on startup
   When the app tries to call `resources/list`, `tools/list`, and `prompts/list`
   Then an inline error message is shown in each section independently (not a silent failure) (UX-DR7)

7. **AC7 — Loading indicators per section**
   Given the three list calls are in-flight
   When the page renders
   Then a loading indicator is visible per section until the list resolves (UX-DR8)

8. **AC8 — Centralized copy module**
   Given the project is scaffolded
   When the `client/src/copy/mcpExplainer.ts` module is created
   Then it exports a constants object containing the three section blurbs and at least one post-action message template; all educational copy in Stories 4.1–4.5 must be sourced from this module (FR27)

## Tasks / Subtasks

- [x] Task 1: Scaffold Vite React app in `client/` (AC: #1)
  - [x] 1.1 Run `npm create vite@latest client -- --template react-ts` from repo root (the `client/` directory already has `.env.example` — preserve it)
  - [x] 1.2 `cd client && npm install`
  - [x] 1.3 Install AG Grid: `npm install ag-grid-react ag-grid-community`
  - [x] 1.4 Copy `.env.example` to `.env` for local dev: `VITE_MCP_PROXY_URL=http://localhost:3001`
  - [x] 1.5 Verify `npm run dev` boots without errors
  - [x] 1.6 Remove Vite boilerplate content from `App.tsx` (logos, counter, default CSS)

- [x] Task 2: Create MCP client module `client/src/mcp/client.ts` (AC: #2, #6)
  - [x] 2.1 Create a `sendJsonRpc(method, params)` function that POSTs JSON-RPC 2.0 to `VITE_MCP_PROXY_URL/mcp`
  - [x] 2.2 The function must send `initialize` on first call, then cache that it's initialized (MCP handshake required before any other request)
  - [x] 2.3 Handle errors: proxy unreachable → throw with clear message; JSON-RPC `error` in response → throw with `error.message`
  - [x] 2.4 Export typed helper functions: `listResources()`, `listTools()`, `listPrompts()` that call `sendJsonRpc` with the appropriate method
  - [x] 2.5 Use `import.meta.env.VITE_MCP_PROXY_URL` for the base URL

- [x] Task 3: Create `McpContext` in `client/src/context/McpContext.tsx` (AC: #2, #6, #7)
  - [x] 3.1 Define context state: `resources`, `tools`, `prompts` arrays; per-section loading/error state (`idle | loading | error` for each of resources, tools, prompts)
  - [x] 3.2 On mount, call `listResources()`, `listTools()`, `listPrompts()` in parallel
  - [x] 3.3 Store results in state; on error, set the corresponding section's error message
  - [x] 3.4 Export a `useMcp()` hook that throws if used outside the provider

- [x] Task 4: Create centralized copy module `client/src/copy/mcpExplainer.ts` (AC: #8)
  - [x] 4.1 Export `MCP_COPY` constant object with keys: `resourcesBlurb`, `toolsBlurb`, `promptsBlurb`, `postActionRead`, `postActionCall`, `postActionInvoke`, `postActionList`
  - [x] 4.2 Use exact blurb text from acceptance criteria

- [x] Task 5: Create `ResourcesPanel` component (AC: #3, #6, #7)
  - [x] 5.1 Create `client/src/components/ResourcesPanel.tsx`
  - [x] 5.2 Read resources from `useMcp()` context
  - [x] 5.3 Display educational blurb from `MCP_COPY.resourcesBlurb`
  - [x] 5.4 Render each resource: URI, name, description (clickable for future Read — Story 4.2)
  - [x] 5.5 Show loading spinner when loading; show inline error when errored

- [x] Task 6: Create `ToolsPanel` component (AC: #4, #6, #7)
  - [x] 6.1 Create `client/src/components/ToolsPanel.tsx`
  - [x] 6.2 Read tools from `useMcp()` context
  - [x] 6.3 Display educational blurb from `MCP_COPY.toolsBlurb`
  - [x] 6.4 Render each tool: name, description, and summary of `inputSchema` (list required/optional properties)
  - [x] 6.5 Show loading spinner when loading; show inline error when errored

- [x] Task 7: Create `PromptsPanel` component (AC: #5, #6, #7)
  - [x] 7.1 Create `client/src/components/PromptsPanel.tsx`
  - [x] 7.2 Read prompts from `useMcp()` context
  - [x] 7.3 Display educational blurb from `MCP_COPY.promptsBlurb`
  - [x] 7.4 Render each prompt: name, description, argument definitions (name, description, required/optional)
  - [x] 7.5 Show loading spinner when loading; show inline error when errored

- [x] Task 8: Wire up `App.tsx` with all three panels (AC: #2)
  - [x] 8.1 Wrap app in `McpProvider`
  - [x] 8.2 Render `ResourcesPanel`, `ToolsPanel`, `PromptsPanel` in a clean layout (three sections, stacked or tabs)
  - [x] 8.3 Add minimal global styling for readability

- [x] Task 9: Build and verify end-to-end (AC: all)
  - [x] 9.1 Build root MCP server: `npm run build` (in root)
  - [x] 9.2 Start proxy: `cd proxy && npm run dev`
  - [x] 9.3 Start client: `cd client && npm run dev`
  - [x] 9.4 Verify: three sections load with 7 resources, 5 tools, 3 prompts
  - [x] 9.5 Verify: educational blurbs visible in each section
  - [x] 9.6 Verify: stopping proxy shows error state in all sections
  - [x] 9.7 Verify: `npm run build` in `client/` completes with zero TypeScript errors

## Dev Notes

### Architecture Overview

This is the first greenfield React story. It creates the `client/` package that will grow through Stories 4.2–4.5. The goal is a working scaffold that lists all MCP capabilities from the live server via the proxy, with educational copy.

```
Browser (localhost:5173) ──fetch──► Proxy (localhost:3001) ──STDIO──► MCP Server
```

### MCP Initialization Handshake (CRITICAL)

The browser MCP client MUST send `initialize` as its very first JSON-RPC request before calling `resources/list`, `tools/list`, or `prompts/list`. The proxy forwards it transparently. Implementation approach:

```typescript
let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await sendJsonRpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mcp-learner", version: "1.0.0" },
  });
  initialized = true;
}
```

Call `ensureInitialized()` inside every public helper (`listResources`, `listTools`, etc.) before the actual request.

### JSON-RPC Wire Format

The proxy expects JSON-RPC 2.0 with an integer `id` on `POST /mcp`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

The client must generate unique incrementing `id` values per request. The proxy validates that `jsonrpc`, `method`, and `id` are present — requests without `id` return 400.

### Proxy Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | `POST` | JSON-RPC 2.0 request/response |
| `/sse` | `GET` | Server-sent events (notifications) |
| `/health` | `GET` | `{ status, serverAlive }` |

Base URL from env: `import.meta.env.VITE_MCP_PROXY_URL` (default `http://localhost:3001`).

### Server Capabilities (from live server)

The MCP server exposes exactly:

**7 Resources:**
| URI | Name | MIME Type |
|-----|------|-----------|
| `task://all` | All Tasks | `application/json` |
| `task://summary` | Task Summary | `text/plain` |
| `task://table/all` | All Tasks (Table) | `text/markdown` |
| `task://table/by-deadline` | Tasks by Deadline | `text/markdown` |
| `task://table/by-priority` | Tasks by Priority | `text/markdown` |
| `task://table/priority-then-deadline` | Tasks by Priority then Deadline | `text/markdown` |
| `task://open` | Open Tasks | `text/markdown` |

**5 Tools:**
| Name | Required Args | Optional Args |
|------|--------------|---------------|
| `create_task` | title, description | priority, dueDate |
| `update_task` | id | title, description, status, priority, dueDate |
| `update_task_status` | id, status | — |
| `get_task` | id | — |
| `delete_task` | id | — |

**3 Prompts:**
| Name | Arguments |
|------|-----------|
| `tasks_table` | sort (required) |
| `tasks_summary_for_stakeholders` | — |
| `completions_by_date` | from (optional), to (optional) |

### AG Grid Setup

AG Grid v35.x Community edition. Install both packages:
```bash
npm install ag-grid-react ag-grid-community
```

AG Grid is NOT used in this story — it is only installed as a dependency so it's available for Story 4.2+. This story focuses on listing capabilities, not displaying tabular data. Do NOT import AG Grid themes or components yet.

### File Structure (this story creates)

```
client/
├── package.json             # Vite + React + AG Grid deps
├── tsconfig.json             # From Vite template
├── tsconfig.app.json         # From Vite template
├── vite.config.ts            # From Vite template
├── index.html                # From Vite template
├── .env.example              # Already exists: VITE_MCP_PROXY_URL=http://localhost:3001
├── .env                      # Local copy (gitignored)
└── src/
    ├── main.tsx              # From Vite template (renders App)
    ├── App.tsx               # Wires McpProvider + three panels
    ├── App.css               # Minimal global styles
    ├── vite-env.d.ts         # From Vite template
    ├── context/
    │   └── McpContext.tsx     # McpProvider + useMcp hook
    ├── mcp/
    │   └── client.ts         # sendJsonRpc, listResources, listTools, listPrompts
    ├── components/
    │   ├── ResourcesPanel.tsx
    │   ├── ToolsPanel.tsx
    │   └── PromptsPanel.tsx
    └── copy/
        └── mcpExplainer.ts   # Centralized MCP educational copy
```

### Files NOT to Modify

- `src/index.ts` — MCP server unchanged
- `proxy/` — Proxy unchanged
- `package.json` (root) — Server package unchanged
- `client/.env.example` — Already exists from Story 3.1, preserve as-is

### Anti-Patterns to Avoid

1. **Do NOT install `@modelcontextprotocol/sdk` in the client** — the client uses raw `fetch` to POST JSON-RPC to the proxy; no MCP SDK needed in the browser
2. **Do NOT create a WebSocket connection** — architecture specifies HTTP + SSE; use `fetch` for requests and `EventSource` for notifications
3. **Do NOT import or configure AG Grid in this story** — only install the packages; grid usage starts in Story 4.2
4. **Do NOT put educational copy as inline string literals** — all copy comes from `mcpExplainer.ts`
5. **Do NOT add routing** — single page with sections; no React Router for MVP
6. **Do NOT add Redux or Zustand** — use React Context + local state per architecture
7. **Do NOT skip the `initialize` handshake** — the proxy validates and forwards it; MCP server requires it before responding to list requests
8. **Do NOT hardcode `localhost:3001`** — always use `import.meta.env.VITE_MCP_PROXY_URL`
9. **Do NOT swallow fetch errors silently** — every section must show its error state inline
10. **Do NOT add a global error boundary that hides section-level errors** — errors must be visible per-section (UX-DR7)

### Context State Shape

```typescript
interface McpState {
  resources: { status: "idle" | "loading" | "error"; data: Resource[]; error?: string };
  tools: { status: "idle" | "loading" | "error"; data: Tool[]; error?: string };
  prompts: { status: "idle" | "loading" | "error"; data: Prompt[]; error?: string };
}

interface Resource {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}
```

These types mirror MCP SDK response shapes. Define them in `mcp/client.ts` or a shared types file.

### Styling Approach

Use plain CSS (from Vite template) for this story. Keep it minimal and readable — no Tailwind, no CSS-in-JS. The panels should be visually distinct sections with clear headings. Example layout:

- App header with title ("MCP Learning App" or similar)
- Three stacked sections, each with: heading, blurb, item list
- Items displayed as cards or list items showing key metadata
- Loading state: spinner or "Loading..." text
- Error state: red-tinted inline message

### Vite Scaffold Notes

The `client/.env.example` file already exists from Story 3.1. When Vite scaffolds into `client/`, it may overwrite it. The dev should:
1. Back up `.env.example` before scaffolding if Vite would overwrite (check if Vite creates its own)
2. Restore it after scaffolding
3. Alternatively, scaffold to a temp directory and move files, preserving `.env.example`

Since the `client/` directory already has `.env.example`, the safest approach is to scaffold into a temp name (e.g. `client-temp`) and then move files, or scaffold and restore `.env.example`.

### Educational Copy (exact text)

All copy is centralized in `mcpExplainer.ts`. Exact strings:

```typescript
export const MCP_COPY = {
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
  postActionList: (capability: string) =>
    `You listed ${capability} via ${capability.toLowerCase()}/list.`,
} as const;
```

### Project Structure Compliance

| Rule | Requirement |
|------|-------------|
| **Package location** | `client/` at repo root — per architecture |
| **Own package.json** | Client has own deps; does not add deps to root |
| **Entry point** | `client/src/main.tsx` per Vite template |
| **Components** | PascalCase in `client/src/components/` |
| **Context** | `client/src/context/McpContext.tsx` |
| **MCP transport** | `client/src/mcp/client.ts` — raw fetch, no SDK |
| **Copy** | `client/src/copy/mcpExplainer.ts` — centralized |
| **Env var** | `VITE_MCP_PROXY_URL` via `import.meta.env` |
| **No domain logic** | Client lists/displays, does not own task data |

## Previous Story Intelligence

**From Story 3.1 (most recent, done):**
- Proxy is a transparent JSON-RPC forwarder — no MCP awareness, no session management
- `POST /mcp` requires `jsonrpc: "2.0"`, `method`, and `id` — missing any returns 400
- SSE uses `event: message` with JSON-RPC notification data
- `client/.env.example` already created with `VITE_MCP_PROXY_URL=http://localhost:3001`
- Express 5.x with CORS enabled for all origins (dev mode)
- `GET /health` returns `{ status: "ok", serverAlive: boolean }`
- Proxy spawns `node ../build/index.js` (relative to proxy dir)

**Key learnings:**
- Proxy does NOT manage MCP `initialize` state — client must handle this
- Single browser client assumption — no multiplexing
- Server logs to stderr, JSON-RPC on stdout — proxy parses stdout line-by-line
- Request timeout: 30 seconds
- The proxy returns HTTP 503 when the server child is dead, with a JSON-RPC error body

**From Stories 1.1–2.2 (server development):**
- MCP server uses `@modelcontextprotocol/sdk ^1.1.0` with `StdioServerTransport`
- All capabilities (resources, tools, prompts) defined in single `src/index.ts` (647 lines)
- Commit convention: `feat: <description> (Story X.Y)`
- Build: `npm run build` in root → `build/index.js`

## Git Intelligence

**Recent commits (newest first):**
1. `604db76` — feat: add HTTP+SSE proxy bridging browser to MCP server (Story 3.1)
2. `3b9c5f0` — feat: add stakeholder summary and completions-by-date prompts (Story 2.2)
3. `0772368` — docs: add MCP sampling stretch goal note to Epic 5
4. `d276d13` — chore: mark Epic 1 done and Story 2.1 done in sprint status
5. `4c8ee38` — feat: add prompts capability and tasks_table prompt (Story 2.1)

**Convention:** `feat:` prefix for features; story reference in parentheses.

**Suggested commit message:** `feat: scaffold React app and list MCP capabilities with educational blurbs (Story 4.1)`

## Tech Stack Reference

| Item | Value |
|------|-------|
| Scaffold | Vite `react-ts` template (create-vite v9.x) |
| Framework | React 19.x + TypeScript |
| Build | Vite (dev server + Rollup production build) |
| Data Grid (installed, not used yet) | AG Grid Community v35.x (`ag-grid-react`, `ag-grid-community`) |
| MCP Transport | Raw `fetch` → `POST /mcp` on proxy |
| State | React Context (`McpContext`) + local state |
| Styling | Plain CSS (Vite default) |
| Env | `VITE_MCP_PROXY_URL` via `import.meta.env` |

## Verification Steps

1. **Build MCP server:** `npm run build` (in root) — success
2. **Start proxy:** `cd proxy && npm run dev` — `MCP proxy listening on http://localhost:3001`
3. **Install client deps:** `cd client && npm install` — no errors
4. **Start client:** `cd client && npm run dev` — Vite dev server on `localhost:5173`
5. **Browser check:** Open `localhost:5173` — three sections visible: Resources, Tools, Prompts
6. **Resources:** 7 items listed with URI, name, description; blurb visible
7. **Tools:** 5 items listed with name, description, schema summary; blurb visible
8. **Prompts:** 3 items listed with name, description, arguments; blurb visible
9. **Loading states:** Briefly visible on page load (may flash quickly on localhost)
10. **Error state:** Stop proxy → refresh page → all three sections show error messages
11. **Build check:** `cd client && npm run build` — zero TypeScript errors
12. **No server changes:** `src/index.ts` and root `package.json` unchanged

## Definition of Done

- [x] `client/` scaffolded with Vite `react-ts` template and AG Grid deps installed
- [x] `client/src/mcp/client.ts` handles JSON-RPC with `initialize` handshake
- [x] `client/src/context/McpContext.tsx` provides resources, tools, prompts with loading/error state
- [x] `client/src/copy/mcpExplainer.ts` exports all educational copy
- [x] `ResourcesPanel`, `ToolsPanel`, `PromptsPanel` components display items and blurbs
- [x] Loading indicators visible per section during fetch
- [x] Inline error messages shown per section on failure
- [x] All educational copy sourced from `mcpExplainer.ts`, not inline strings
- [x] `npm run build` in `client/` completes with zero TypeScript errors
- [x] No changes to `src/index.ts`, `proxy/`, or root `package.json`
- [x] `client/.env.example` preserved with `VITE_MCP_PROXY_URL=http://localhost:3001`

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus (2026-03-20)

### Debug Log References

- Fixed ESLint `react-hooks/set-state-in-effect` by initializing state with `status: "loading"` instead of calling setState in the effect body
- Fixed ESLint `react-refresh/only-export-components` with targeted suppress for `useMcp` hook (co-located with McpProvider by architecture design)
- Scaffolded to `client-temp/` then moved files to preserve existing `client/.env.example`
- Fixed package name from "client-temp" to "todo-mcp-client"

### Completion Notes List

- Scaffolded Vite React-TS app in `client/` with AG Grid Community v35 installed (not imported)
- Created `mcp/client.ts` with JSON-RPC 2.0 transport: `sendJsonRpc` with auto-incrementing IDs, `ensureInitialized` handshake, and typed helpers (`listResources`, `listTools`, `listPrompts`)
- Created `McpContext` with per-section `{status, data, error}` state; parallel fetch on mount
- Created `mcpExplainer.ts` with exact copy from acceptance criteria plus post-action message templates
- Created three panel components (ResourcesPanel, ToolsPanel, PromptsPanel) each showing section heading, educational blurb, item cards, CSS spinner for loading, and red-tinted inline error
- All three list endpoints verified: 7 resources, 5 tools, 3 prompts displayed correctly
- Error state verified: stopping proxy shows "Proxy unreachable" error independently in each section
- `npm run build` and `npm run lint` pass with zero errors
- No changes to `src/index.ts`, `proxy/`, or root `package.json`
- `client/.env.example` preserved intact

### Change Log

- 2026-03-20: Story 4.1 implemented — scaffolded React client, created MCP JSON-RPC transport, McpContext, three capability panels with educational blurbs, loading/error states

### File List

- client/package.json (new)
- client/index.html (new)
- client/vite.config.ts (new)
- client/tsconfig.json (new)
- client/tsconfig.app.json (new)
- client/tsconfig.node.json (new)
- client/eslint.config.js (new)
- client/.gitignore (new)
- client/.env.example (preserved from Story 3.1)
- client/.env (new, gitignored)
- client/src/main.tsx (new)
- client/src/App.tsx (new)
- client/src/App.css (new)
- client/src/index.css (new)
- client/src/mcp/client.ts (new)
- client/src/context/McpContext.tsx (new)
- client/src/copy/mcpExplainer.ts (new)
- client/src/components/ResourcesPanel.tsx (new)
- client/src/components/ToolsPanel.tsx (new)
- client/src/components/PromptsPanel.tsx (new)
