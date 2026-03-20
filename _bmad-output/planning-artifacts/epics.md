---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - mcp_task_manager_extension.plan.md
---

# todo-mcp-server - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for todo-mcp-server, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

```
FR1: The server exposes a Task model with optional dueDate (ISO date or datetime); existing fields (title, description, status, priority) unchanged.
FR2: The client can create a task with optional dueDate via create_task; new tasks persist with due date when provided.
FR3: update_task (or equivalent) accepts optional dueDate, priority, title, description, status; changes persist.
FR4: URI task://table/all returns all tasks as markdown table (ID, Title, Priority, Due, Status); resources/read returns mimeType text/markdown.
FR5: URI task://table/by-deadline returns same columns sorted by dueDate (nulls last or first, consistent).
FR6: URI task://table/by-priority returns same columns sorted by priority (e.g. high → medium → low).
FR7: URI task://table/priority-then-deadline returns same columns sorted by priority then due date within priority.
FR8: URI task://open returns only todo and in-progress tasks as markdown table or list.
FR9: task://all (JSON) and task://summary (text) remain available and unchanged in behavior for backward compatibility.
FR10: Server declares prompts capability; prompts/list and prompts/get respond per MCP SDK schemas.
FR11: Prompt tasks_table accepts sort (deadline | priority | priority-then-deadline); returns one user PromptMessage with that markdown table.
FR12: Prompt tasks_summary_for_stakeholders returns user message with counts by status, overdue count, optional small table of overdue tasks.
FR13: Prompt completions_by_date accepts optional from/to; returns user message with markdown table or Mermaid of completed tasks by date.
FR14: Proxy spawns task-manager over STDIO; exposes HTTP + SSE (or WebSocket) to browser; forwards MCP JSON-RPC between browser and server.
FR15: React app connects only to proxy URL in dev; no direct STDIO from browser.
FR16: Core MCP server continues STDIO for Claude Desktop and Cursor; proxy is additional path only.
FR17: App lists Resources via resources/list with URI, name, description; blurb explains Resources are read-only by URI and how to Read.
FR18: App lists Tools via tools/list with name, description, input schema; blurb explains Tools and Call with arguments.
FR19: App lists Prompts via prompts/list with name, description, arguments; blurb explains Prompts and Invoke.
FR20: Selecting a resource triggers resources/read; tabular results (JSON task array or markdown table) shown in AG Grid by default; raw markdown fallback if needed.
FR21: application/json task arrays and text/markdown tables parsed and displayed in AG Grid; markdown view secondary/optional.
FR22: Each tool has form fields matching inputSchema; submit calls tools/call and shows result.
FR23: After create_task or update_task, app can refresh and show note that user used a Tool and server state changed.
FR24: User invokes prompt with optional arguments; prompts/get; tabular markdown shown in AG Grid with line that content came from a Prompt; raw markdown fallback.
FR25: All tabular data from resources, tool results, and prompt results in AG Grid where feasible; columns ID, Title, Description, Status, Priority, Due date, Created; client-side sort/filter; switch data source and refresh.
FR26: Educational note near grid links view to Read from Resource or Tool/Prompt result and AG Grid learning goal.
FR27: Copy uses Resource, Tool, Prompt, List, Read, Call, Invoke, URI, input schema, arguments consistently.
FR28: After list/read/call/invoke, short copy explains what happened (e.g. read URI, invoked prompt name).
```

### NonFunctional Requirements

```
NFR1: Educational first — UI copy and flow teach MCP; each of Resources, Tools, Prompts has at least one visible blurb and one post-action explanation.
NFR2: Compatibility — existing Claude Desktop and Cursor STDIO usage unchanged; new behavior additive; no breaking change to task://all, task://summary, or current tools.
NFR3: AG Grid first (learning) — tabular data from resources, tools, prompts in AG Grid by default; markdown/Mermaid only fallback or alongside.
NFR4: Tech stack — React front-end, AG Grid as primary data layer, MCP client over HTTP/SSE (or WebSocket) to proxy; server and proxy TypeScript/Node.
```

### Additional Requirements

```
- React client greenfield: initialize with Vite official react-ts template; first client implementation story scaffolds client/ and adds AG Grid + MCP deps (Epic 4 entry).
- MCP server and proxy are not starter-based: extend existing server; proxy is small Node/TS process (e.g. Express or native HTTP + SSE).
- Proxy transport: HTTP + SSE for browser ↔ proxy; forward JSON-RPC transparently; document proxy routes (e.g. POST /mcp or /rpc) in README.
- AG Grid: Community edition for MVP.
- Tabular pipeline: server shared helper Task[] → markdown table (stable column order aligned with client); client parses markdown tables and JSON task arrays into row objects for AG Grid.
- React state: Context for MCP connection, current result, last error; local state for forms and selection; no Redux for MVP.
- Repo layout: server in root src/; new proxy/ and client/ packages; do not embed proxy inside React app or mix proxy into server entry.
- Client env: VITE_MCP_PROXY_URL for proxy base URL.
- Naming: PascalCase React components; camelCase Task fields and TS APIs; MCP URIs and tool names match PRD exactly.
- Dates: ISO 8601 strings; display via consistent formatter (e.g. toLocaleString).
- Errors: MCP error forwarded through proxy; React shows message to user; full payload dev-only logging.
- Loading: per-section or per-action idle | loading | error on triggering component or context.
- Educational copy centralized (e.g. client/src/copy/mcpExplainer.ts) for terminology consistency.
- MVP: local dev only; no auth; in-memory task store unchanged; proxy API/SSE event format defined in proxy implementation story.
- Optional post-MVP: task://chart/completions-by-date; About MCP glossary; date-range args for prompts.
```

### UX Design Requirements

_No standalone UX specification document; the following are actionable UI/UX expectations from PRD, architecture, and plan for story-level acceptance criteria._

```
UX-DR1: Three primary sections (Resources, Tools, Prompts), each with a visible educational blurb defining that MCP capability and how to use it (List, Read, Call, Invoke).
UX-DR2: Shared grid experience: AG Grid as default for any tabular payload from resource read, tool call, or prompt result; secondary raw markdown view where applicable.
UX-DR3: Tool forms and prompt argument forms generated from inputSchema / prompt argument definitions; labels and validation aligned with schema.
UX-DR4: Post-action micro-copy after list, read, call, and invoke that states what occurred using correct MCP terms and URIs/names where relevant.
UX-DR5: Grid chrome includes short educational note tying current data to Resource read vs Tool vs Prompt and stating AG Grid learning intent.
UX-DR6: After mutating tools (create_task, update_task), surface success and optional refresh plus fixed copy that Tools change server state.
UX-DR7: Global or contextual error presentation for MCP/proxy failures (inline or toast per architecture); avoid silent failures.
UX-DR8: Loading and error states visible per capability section or per user-initiated MCP action.
UX-DR9: Optional post-MVP: About MCP / glossary or diagram area (plan §5 story 4.5); defer unless pulled into MVP scope.
UX-DR10: Chat panel with persistent text input and scrollable conversation history; user messages right-aligned, AI responses left-aligned with explanation text and optional AG Grid result below.
UX-DR11: After the LLM executes an MCP operation, a brief educational note appears in the chat response explaining which MCP capability was used (e.g. "I read the resource task://table/by-priority to show you this data").
UX-DR12: Loading state visible in the chat panel while the LLM is processing (typing indicator or spinner); input disabled during processing to prevent duplicate requests.
UX-DR13: LLM or MCP errors surfaced inline in the chat conversation as error messages, not silent failures.
```

### FR Coverage Map

| FR | Epic | Brief |
|----|------|-------|
| FR1 | Epic 1 | Task model with optional dueDate |
| FR2 | Epic 1 | create_task with dueDate |
| FR3 | Epic 1 | update_task fields |
| FR4 | Epic 1 | task://table/all markdown |
| FR5 | Epic 1 | task://table/by-deadline |
| FR6 | Epic 1 | task://table/by-priority |
| FR7 | Epic 1 | task://table/priority-then-deadline |
| FR8 | Epic 1 | task://open |
| FR9 | Epic 1 | Backward-compatible JSON/summary resources |
| FR10 | Epic 2 | prompts capability, list/get |
| FR11 | Epic 2 | tasks_table prompt |
| FR12 | Epic 2 | tasks_summary_for_stakeholders prompt |
| FR13 | Epic 2 | completions_by_date prompt |
| FR14 | Epic 3 | Proxy spawns server, HTTP+SSE, JSON-RPC |
| FR15 | Epic 3 | React connects only via proxy |
| FR16 | Epic 3 | STDIO unchanged for desktop clients |
| FR17 | Epic 4 | List Resources + educational copy |
| FR18 | Epic 4 | List Tools + educational copy |
| FR19 | Epic 4 | List Prompts + educational copy |
| FR20 | Epic 4 | Read resource → AG Grid default |
| FR21 | Epic 4 | Parse JSON + markdown tables to grid |
| FR22 | Epic 4 | Tool forms + tools/call |
| FR23 | Epic 4 | Post–mutating-tool note + refresh |
| FR24 | Epic 4 | Invoke prompt → AG Grid for tables |
| FR25 | Epic 4 | Unified grid columns, sort/filter, sources |
| FR26 | Epic 4 | Grid educational note |
| FR27 | Epic 4 | Consistent MCP terminology |
| FR28 | Epic 4 | Post-action explanations |
| FR29 | Epic 5 | Chat interface for natural language |
| FR30 | Epic 5 | LLM endpoint on proxy (Ollama default) |
| FR31 | Epic 5 | Execute LLM-selected MCP operation, display in grid |
| FR32 | Epic 5 | Multi-turn conversation history |

**NFR touchpoints:** NFR2 across Epics 1–3 (additive server/proxy); NFR1, NFR3, NFR4 primarily Epic 4; NFR2 also Epic 4 (no breaking desktop behavior). NFR1 also Epic 5 (educational LLM-to-MCP explanations).

## Epic List

### Epic 1: Task management with deadlines and table resources

**User outcome:** Any MCP client (e.g. Claude Desktop, Cursor) can create and update tasks with optional due dates and read tasks as markdown tables or existing JSON/text resources—without prompts or a browser.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9

**Standalone:** Delivers full server-side task lifecycle and read-only table views; desktop workflows keep working (NFR2).

---

### Epic 2: Prompt-based task views and summaries

**User outcome:** Users can discover and invoke server-authored prompts for sorted task tables, stakeholder summaries, and completions-by-date content.

**FRs covered:** FR10, FR11, FR12, FR13

**Standalone:** Prompts layer is complete for STDIO clients once Epic 1 exists; does not require proxy or React.

**Depends on:** Epic 1 (task data and markdown table semantics).

---

### Epic 3: Browser bridge to the MCP server

**User outcome:** A browser-based client can talk to the same MCP server over HTTP/SSE while Claude/Cursor continue to use STDIO unchanged.

**FRs covered:** FR14, FR15, FR16

**Standalone:** Proxy + connectivity; value is “MCP from the web” for a client you run locally.

**Depends on:** Epic 1 (and Epic 2 optional for full prompt surface in browser later).

---

### Epic 4: Learn MCP in the browser with AG Grid

**User outcome:** Learners explore Resources, Tools, and Prompts in one educational app, with tabular data shown in AG Grid by default and copy that teaches MCP.

**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28

**Standalone:** Full MVP learning client once proxy is available.

**Depends on:** Epic 3 (and functionally Epic 1 + Epic 2 for complete capability listing in the UI).

---

### Epic 5: Natural language MCP interaction via LLM

**User outcome:** Learners type plain-language requests into a chat interface and watch an LLM interpret them, select the right MCP operation, execute it, and display the results — demonstrating how AI agents interact with MCP servers under the hood.

**FRs covered:** FR29, FR30, FR31, FR32

**Standalone:** Adds AI-mediated MCP interaction layer on top of the manual UI.

**Depends on:** Epic 3 (proxy running), Epic 4 (React app with AG Grid and MCP client infrastructure).

---

## Epic 1: Task Management with Deadlines and Table Resources

Users can create and update tasks with optional due dates and read tasks as markdown tables through any MCP client (Claude Desktop, Cursor, or browser). All existing JSON and summary resources continue to work unchanged.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9
**NFRs:** NFR2 (compatibility — zero breaking changes)
**Additional:** Shared server helper `Task[] → markdown table`; ISO 8601 dates; stable column order.

---

### Story 1.1: Add dueDate to the Task model and create_task tool

As a developer or AI assistant using the MCP server,
I want to create tasks with an optional due date,
So that I can track deadlines alongside existing task fields.

**Acceptance Criteria:**

**Given** the server is running and a client issues a `tools/call` for `create_task`
**When** the call includes an optional `dueDate` argument (ISO 8601 date string, e.g. `"2026-04-01"`)
**Then** the task is persisted with `dueDate` set to the provided value
**And** the `Task` TypeScript interface includes `dueDate?: string`

**Given** a `create_task` call is made without `dueDate`
**When** the tool executes
**Then** the task is created with `dueDate` undefined and all other existing behaviour is unchanged

**Given** the existing `task://all` JSON resource is read
**When** a task was created with `dueDate`
**Then** the response includes `dueDate` in that task's JSON object

**Given** an existing client (Claude Desktop / Cursor) using `create_task` without `dueDate`
**When** the upgraded server is running
**Then** no error occurs and existing fields (title, description, status, priority) behave as before

---

### Story 1.2: Add update_task tool for modifying task fields

As a developer or AI assistant using the MCP server,
I want to update a task's fields (title, description, status, priority, dueDate) after creation,
So that I can correct deadlines, reprioritise, and change task status without deleting and recreating.

**Acceptance Criteria:**

**Given** the server is running and a task exists with a known ID
**When** a client calls `update_task` with that ID and one or more of `{title, description, status, priority, dueDate}`
**Then** only the supplied fields are updated; unspecified fields remain unchanged

**Given** a task with `dueDate` set
**When** `update_task` is called with a new `dueDate` value
**Then** the task's `dueDate` is updated and the change is visible in subsequent resource reads

**Given** `update_task` is called with a `dueDate` of `null` or omitted
**When** `dueDate` was previously set
**Then** the field is cleared (or left unchanged if omitted), per documented tool contract

**Given** `update_task` is called with an unknown task ID
**When** the tool executes
**Then** the server returns a clear MCP error response (non-zero code, descriptive message)

**Given** `update_task` is called with an invalid `status` value
**When** the tool executes
**Then** the server returns a validation error and the task is not modified

---

### Story 1.3: Add markdown table resources and shared table helper

As a developer or AI assistant using the MCP server,
I want to read tasks as formatted markdown tables sorted by deadline, priority, or both,
So that I can view task data in a structured way without building my own formatter.

**Acceptance Criteria:**

**Given** the server is running with at least one task
**When** a client reads `task://table/all`
**Then** the response has `mimeType: "text/markdown"` and contains a pipe-delimited table with columns ID, Title, Priority, Due, Status, with one row per task

**Given** tasks exist with and without `dueDate`
**When** a client reads `task://table/by-deadline`
**Then** rows are sorted ascending by `dueDate`; tasks without a due date appear consistently (last or first, per implementation choice documented in code)

**Given** tasks exist with mixed priorities (high, medium, low)
**When** a client reads `task://table/by-priority`
**Then** rows are ordered high → medium → low

**Given** tasks exist with mixed priorities and due dates
**When** a client reads `task://table/priority-then-deadline`
**Then** rows are ordered by priority first, then by `dueDate` ascending within each priority group

**Given** the server is running with a mix of todo, in-progress, and done tasks
**When** a client reads `task://open`
**Then** the response contains only tasks with status `todo` or `in-progress` as a markdown table or list

**Given** `task://all` (JSON) and `task://summary` (text) are read after adding the new resources
**When** the server is running
**Then** both resources return responses identical in shape and content to their pre-extension behaviour (NFR2)

**And** a shared internal helper function (e.g. `markdownTable(tasks)`) produces the markdown rows used by all four table resources, ensuring column order is stable across all endpoints

**Given** all five new markdown resources have been implemented (`task://table/all`, `task://table/by-deadline`, `task://table/by-priority`, `task://table/priority-then-deadline`, `task://open`)
**When** each URI is read individually via `resources/read`
**Then** each returns a valid `text/markdown` response with the correct sort order or filter — all five URIs must be verified, not just `task://table/all`

---

## Epic 2: Prompt-based Task Views and Summaries

Users can discover and invoke server-authored prompts from any MCP client to get sorted task tables, stakeholder summaries, and completions-by-date content in markdown.

**FRs covered:** FR10, FR11, FR12, FR13
**Depends on:** Epic 1 (task data and shared markdown table helper)

---

### Story 2.1: Enable prompts capability and implement tasks_table prompt

As a developer or AI assistant using the MCP server,
I want to list prompts and invoke a tasks_table prompt with a sort argument,
So that I can retrieve a formatted task table in one prompt invocation rather than reading a resource and sorting manually.

**Acceptance Criteria:**

**Given** the server starts up
**When** a client sends `initialize`
**Then** the server's capabilities include `prompts: {}` (or equivalent per SDK)

**Given** the prompts capability is enabled
**When** a client calls `prompts/list`
**Then** the response includes at least one prompt entry with `name: "tasks_table"` and its argument definition for `sort`

**Given** a client calls `prompts/get` with `name: "tasks_table"` and `arguments: { sort: "deadline" }`
**When** the server handles the request
**Then** the response contains `messages` with one user-role `PromptMessage` whose `content.text` is the same markdown table as `task://table/by-deadline`

**Given** `sort` is `"priority"`
**When** `prompts/get` is called for `tasks_table`
**Then** the returned table matches `task://table/by-priority`

**Given** `sort` is `"priority-then-deadline"`
**When** `prompts/get` is called for `tasks_table`
**Then** the returned table matches `task://table/priority-then-deadline`

**Given** an invalid `sort` value is provided
**When** `prompts/get` is called
**Then** the server returns a descriptive error response

---

### Story 2.2: Implement tasks_summary_for_stakeholders and completions_by_date prompts

As a developer or AI assistant using the MCP server,
I want prompts that summarise task status for stakeholders and show completed tasks grouped by date,
So that I can generate reports with a single prompt invocation.

**Acceptance Criteria:**

**Given** `prompts/list` is called
**When** the server responds
**Then** the list includes `tasks_summary_for_stakeholders` and `completions_by_date` with their argument definitions

**Given** a client calls `prompts/get` with `name: "tasks_summary_for_stakeholders"`
**When** the server handles the request
**Then** the response contains one user-role `PromptMessage` with a markdown summary including: count of tasks by status (todo / in-progress / done), overdue count (tasks with `dueDate` before today that are not done), and a small table of overdue tasks (if any exist)

**Given** a client calls `prompts/get` with `name: "completions_by_date"` and no arguments
**When** the server handles the request
**Then** the response contains one user-role `PromptMessage` with a markdown table of dates and completed-task counts for all completed tasks

**Given** `completions_by_date` is called with optional `from` and/or `to` date arguments
**When** the server handles the request
**Then** only completed tasks whose completion date falls within the range are included

**Given** no tasks are completed
**When** `completions_by_date` is invoked
**Then** the response still returns a valid `PromptMessage` (empty table or a note that no completed tasks exist)

**Given** the original `tasks_table` prompt from Story 2.1 is called after adding the two new prompts
**When** `prompts/list` is called
**Then** all three prompts are listed and individually callable without regression

---

## Epic 3: Browser Bridge to the MCP Server

A browser-based MCP client can communicate with the same MCP server over HTTP and SSE while Claude Desktop and Cursor continue to use STDIO without any changes.

**FRs covered:** FR14, FR15, FR16
**Depends on:** Epic 1 (runnable server binary); Epic 2 optional for full prompt surface.
**Additional:** New `proxy/` package; `VITE_MCP_PROXY_URL` for client; proxy routes documented in `proxy/README.md`.

---

### Story 3.1: Build HTTP+SSE proxy that bridges browser to MCP server over STDIO

As a browser-based MCP client developer,
I want a proxy process that accepts HTTP requests and SSE connections from the browser and forwards MCP JSON-RPC to the task-manager server over STDIO,
So that the browser can use all MCP capabilities without needing native STDIO support.

**Acceptance Criteria:**

**Given** the proxy is started (e.g. `cd proxy && npm run dev`)
**When** it initialises
**Then** it spawns the compiled MCP server (`node build/index.js` or equivalent) as a child process connected via STDIO

**Given** the proxy is running and the MCP server child process is alive
**When** a browser client sends a valid MCP JSON-RPC request (e.g. `resources/list`) to the proxy's HTTP endpoint (e.g. `POST /mcp`)
**Then** the proxy forwards the message to the server over STDIO and returns the server's JSON-RPC response to the browser

**Given** the proxy is running
**When** a browser client opens an SSE connection to the proxy's SSE endpoint
**Then** the proxy streams server-initiated MCP messages (e.g. resource change notifications) back to the browser over SSE

**Given** Claude Desktop and Cursor are configured to use the MCP server via STDIO
**When** the proxy is also running
**Then** desktop clients continue to communicate directly with the server via their own STDIO channel; proxy has no effect on them (FR16)

**Given** the proxy HTTP and SSE endpoints are running
**When** the server child process exits unexpectedly
**Then** the proxy logs an error and returns an appropriate error response to connected browser clients (no silent failure)

**Given** a `.env.example` file exists in `client/` with `VITE_MCP_PROXY_URL=http://localhost:3001`
**When** a developer sets up the project
**Then** they can configure the React app to point to the proxy by copying the example and setting the URL

**And** proxy routes (HTTP endpoint path, SSE endpoint path, port) are documented in `proxy/README.md`, including:
- The exact HTTP endpoint path and method for sending MCP JSON-RPC requests (e.g. `POST /mcp`)
- The exact SSE endpoint path for receiving server-initiated messages (e.g. `GET /mcp/events`)
- The SSE event format (event name, data shape) so the React client can parse them without guessing
- The default port (e.g. 3001) and how to override it

---

## Epic 4: Learn MCP in the Browser with AG Grid

Learners open the React app to explore all MCP capabilities — Resources, Tools, and Prompts — with tabular data shown in AG Grid by default and in-app copy that teaches MCP concepts at each step.

**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR6, UX-DR7, UX-DR8
**Depends on:** Epic 3 (proxy running); Epic 1 + Epic 2 for full capability surface.
**Additional:** Vite react-ts scaffold; AG Grid Community; `VITE_MCP_PROXY_URL`; `McpContext`; centralized copy module.

---

### Story 4.1: Scaffold React app and list Resources, Tools, and Prompts with educational blurbs

As a learner opening the React app for the first time,
I want to see all server capabilities (Resources, Tools, Prompts) listed in three sections with educational explanations,
So that I immediately understand what each MCP capability type is before I interact with it.

**Acceptance Criteria:**

**Given** a developer runs `npm create vite@latest client -- --template react-ts` and installs deps including `ag-grid-react ag-grid-community`
**When** `cd client && npm run dev` is executed
**Then** the app starts on `localhost:5173` (or configured port) without errors

**Given** the app loads and `VITE_MCP_PROXY_URL` is set
**When** the page renders
**Then** the app calls `resources/list`, `tools/list`, and `prompts/list` via the proxy and displays the results in three distinct sections labelled Resources, Tools, and Prompts

**Given** the Resources section renders
**When** the list is populated
**Then** each resource shows its URI, name, and description; a visible blurb reads: "Resources are read-only data the server exposes by URI. Click a resource to Read it." (FR17, UX-DR1)

**Given** the Tools section renders
**When** the list is populated
**Then** each tool shows its name, description, and a summary of its input schema; a visible blurb reads: "Tools are actions the client can invoke with arguments. Fill the form and Call a tool." (FR18, UX-DR1)

**Given** the Prompts section renders
**When** the list is populated
**Then** each prompt shows its name, description, and arguments; a visible blurb reads: "Prompts are pre-built messages the server returns. Invoke a prompt to get that content." (FR19, UX-DR1)

**Given** the proxy is unreachable on startup
**When** the app tries to call `resources/list`
**Then** an inline error message is shown in the Resources section (not a silent failure) (UX-DR7)

**Given** the three list calls are in-flight
**When** the page renders
**Then** a loading indicator is visible per section until the list resolves (UX-DR8)

**Given** the project is scaffolded
**When** the `client/src/copy/mcpExplainer.ts` module is created
**Then** it exports a constants object containing at minimum the three section blurbs (Resources, Tools, Prompts) and at least one post-action message template; all educational copy in Stories 4.1–4.5 must be sourced from this module rather than inline string literals (FR27)

---

### Story 4.2: Read a Resource and display tabular results in AG Grid

As a learner,
I want to click a resource, read it from the server, and see tabular data in AG Grid,
So that I learn what a Resource Read looks like and practise AG Grid.

**Acceptance Criteria:**

**Given** the Resources section is populated
**When** a user clicks a resource URI (e.g. `task://table/by-deadline`)
**Then** the app calls `resources/read` with that URI and displays the response

**Given** the resource response is `text/markdown` with a markdown table
**When** the result is displayed
**Then** the app parses the markdown into row objects and renders them in AG Grid with columns: ID, Title, Priority, Due, Status (FR20, FR21, UX-DR2)

**Given** the resource response is `application/json` containing a task array (e.g. `task://all`)
**When** the result is displayed
**Then** the app maps the JSON array to row objects and renders them in AG Grid with the same column set (FR21)

**Given** the grid is rendered
**When** a user clicks a column header
**Then** the grid sorts by that column client-side (FR25)

**Given** the grid is rendered
**When** a user types in a filter input
**Then** the grid filters rows client-side (FR25)

**Given** the grid is rendered with data
**When** the user sees the grid
**Then** a short note is visible near the grid: "This grid shows data Read from a Resource. We're using AG Grid as much as possible so you can learn it while learning MCP." (FR26, UX-DR5)

**Given** the user switches from one resource to another (e.g. from `task://table/all` to `task://table/by-priority`)
**When** the new resource is read
**Then** the grid updates to show the new data set without a page reload (FR25)

**Given** a `resources/read` call fails (e.g. proxy error)
**When** the error is received
**Then** an inline error is shown and the grid shows no stale data from the previous read (UX-DR7)

---

### Story 4.3: Call a Tool from a schema-driven form and see the result

As a learner,
I want to fill a form built from a tool's input schema, submit it, and see confirmation including an educational note about what just happened,
So that I understand what calling a Tool does and why it differs from reading a Resource.

**Acceptance Criteria:**

**Given** a tool (e.g. `create_task`) is selected in the Tools section
**When** the panel renders
**Then** a form is displayed with fields matching the tool's `inputSchema` properties (e.g. title, description, priority, dueDate) with correct field types (text, select, date) (FR22, UX-DR3)

**Given** required fields are defined in `inputSchema`
**When** a user submits without filling them
**Then** client-side validation prevents submission and highlights the missing fields

**Given** the form is filled and submitted
**When** the app calls `tools/call` with the provided arguments
**Then** the result (success or MCP tool result) is displayed below the form (FR22)

**Given** a mutating tool (`create_task` or `update_task`) succeeds
**When** the result is displayed
**Then** a note reads: "You just used a Tool — the server state changed." and an option to refresh the Resource grid is presented (FR23, UX-DR6)

**Given** the tool result contains tabular data (e.g. a task list returned by a read-like tool)
**When** the result renders
**Then** it is displayed in AG Grid using the same shared grid component and column defs (FR25)

**Given** a `tools/call` request is in-flight
**When** the user waits
**Then** the submit button shows a loading state and is disabled to prevent duplicate calls (UX-DR8)

**Given** `tools/call` returns an MCP error
**When** the error is received
**Then** an inline error message is shown with the error's `message` field; the form remains filled for correction (UX-DR7)

---

### Story 4.4: Invoke a Prompt with arguments and see tabular results in AG Grid

As a learner,
I want to select a prompt, fill in any arguments, invoke it, and see the returned content with a note explaining it came from a Prompt,
So that I understand what MCP Prompts are and how they differ from Resources and Tools.

**Acceptance Criteria:**

**Given** the Prompts section is populated
**When** a user selects a prompt (e.g. `tasks_table`)
**Then** an argument form is displayed with fields matching the prompt's argument definitions (e.g. `sort` as a select) (FR24, UX-DR3)

**Given** the argument form is filled (or empty for prompts with no required args)
**When** the user clicks Invoke
**Then** the app calls `prompts/get` with the prompt name and arguments and displays the returned message content

**Given** the returned `PromptMessage` content is a markdown table
**When** the result is displayed
**Then** the app parses the markdown table into row objects and shows them in AG Grid with a note: "This content came from a Prompt — shown here in the grid." (FR24, UX-DR2, UX-DR4)

**Given** the returned content is a text summary (e.g. `tasks_summary_for_stakeholders`)
**When** the result is displayed
**Then** the content is rendered as formatted markdown or, where parseable as tabular data (e.g. an overdue-tasks table within the summary), sub-sections are shown in AG Grid (FR24)

**Given** a `prompts/get` call is in-flight
**When** the user waits
**Then** the Invoke button shows a loading state and is disabled (UX-DR8)

**Given** `prompts/get` returns an error
**When** the error is received
**Then** an inline error message is shown; the argument form remains filled (UX-DR7)

---

### Story 4.5: Consistent MCP terminology, post-action copy, errors, and loading polish

As a learner using the app end-to-end,
I want all MCP terms used consistently, post-action messages to always appear, and errors and loading states to be clearly visible throughout,
So that I never have to guess what the app is doing or what MCP concept I just exercised.

**Acceptance Criteria:**

**Given** all text in the app (labels, blurbs, notes, error messages)
**When** a reviewer reads the copy
**Then** only MCP canonical terms are used: Resource, Tool, Prompt, List, Read, Call, Invoke, URI, input schema, arguments — with no synonyms or inconsistencies (FR27)

**Given** the centralized copy module exists (e.g. `client/src/copy/mcpExplainer.ts`)
**When** any panel or component displays educational text
**Then** the text is sourced from that module rather than inline string literals, ensuring one place to update terminology

**Given** any MCP action completes (list, read, call, invoke)
**When** the result is shown
**Then** a context-appropriate post-action line is visible, e.g. "You listed Resources via resources/list," "You read task://table/by-deadline," "You called create_task," "You invoked the tasks_table prompt." (FR28, UX-DR4)

**Given** any section's data is loading (list, read, call, invoke)
**When** the request is in-flight
**Then** a loading indicator is visible in that section and interactive elements are disabled to prevent duplicate actions (UX-DR8)

**Given** any MCP or proxy error occurs anywhere in the app
**When** the error is received
**Then** an inline or contextual error message shows the `message` field; no section shows stale data without a visible error indicator; the app does not crash (UX-DR7)

**Given** all four stories in Epic 4 have been implemented
**When** the app is reviewed end-to-end
**Then** all UX-DRs 1–8 are demonstrably satisfied across the three panels and the grid experience

---

## Epic 5: Natural Language MCP Interaction via LLM

Learners can type plain-language requests into a chat interface and watch an LLM interpret them, select the right MCP operation (resource read, tool call, or prompt invocation), execute it, and display the results — demonstrating how AI agents interact with MCP servers under the hood.

**FRs covered:** FR29, FR30, FR31, FR32
**UX-DRs covered:** UX-DR10, UX-DR11, UX-DR12, UX-DR13
**Depends on:** Epic 3 (proxy running), Epic 4 (React app with AG Grid and MCP client infrastructure)
**Additional:** LLM endpoint on proxy; `LLM_BASE_URL` and `LLM_MODEL` env vars; Ollama as default LLM provider (no SDK — fetch against OpenAI-compatible API); configurable for cloud providers. `ChatPanel.tsx` component; conversation state in React context or local state.

---

### Story 5.1: Add LLM interpretation endpoint to proxy and chat UI to React app

As a learner using the React app,
I want to type a plain-language request like "show me all high priority tasks" into a chat input,
So that an AI interprets my request, executes the right MCP operation, and shows me the result — teaching me how AI agents use MCP.

**Acceptance Criteria:**

**Given** the proxy is running and Ollama is available at the configured `LLM_BASE_URL` (default `http://localhost:11434`) with `LLM_MODEL` pulled (e.g. `llama3.1`)
**When** the React app sends a POST request to `/llm/interpret` with `{ message: "show me tasks sorted by deadline", history: [] }`
**Then** the proxy calls the LLM API with a system prompt describing all available MCP capabilities (from `resources/list`, `tools/list`, `prompts/list`) and returns a structured response containing: the MCP operation to execute (`type`, `params`), a human-readable explanation, and the MCP operation result

**Given** the React app is loaded
**When** the user navigates to the chat panel
**Then** a text input and conversation area are visible; the input accepts free-text entry and submits on Enter or button click

**Given** the user types "show me overdue tasks sorted by priority" and submits
**When** the proxy processes the request
**Then** the LLM selects the appropriate MCP operation (e.g. read `task://table/by-priority` or invoke `tasks_summary_for_stakeholders`), the proxy executes it, and the chat panel displays: (1) the AI's explanation of what it did, (2) the MCP result in AG Grid if tabular, and (3) an educational note like "The AI read the resource task://table/by-priority — this is exactly how an MCP client uses Resources." (FR31, UX-DR11)

**Given** the LLM request is in-flight
**When** the user waits
**Then** a loading indicator is visible in the chat area and the input is disabled (UX-DR12)

**Given** the LLM API returns an error (provider unreachable, malformed response)
**When** the error is received
**Then** an error message is shown inline in the chat conversation (UX-DR13)

**Given** Ollama is not running or the configured LLM provider is unreachable
**When** the proxy starts or receives a `/llm/interpret` request
**Then** the proxy returns a clear error; the React app shows the chat panel with a note: "LLM features require Ollama running locally. Install with `brew install ollama` and run `ollama pull llama3.1`."

---

### Story 5.2: Multi-turn conversation and educational integration

As a learner using the chat interface,
I want to have a back-and-forth conversation where follow-up requests build on previous context,
So that I can explore task data naturally and learn how AI agents maintain context across MCP interactions.

**Acceptance Criteria:**

**Given** the user has already asked "show me all tasks" and received a result
**When** the user types "now filter to just the high priority ones"
**Then** the LLM receives the conversation history, understands the follow-up context, selects the appropriate MCP operation, and the chat panel shows the refined result (FR32)

**Given** a conversation is in progress
**When** the user scrolls the chat area
**Then** the full conversation history (user messages, AI explanations, and previous results) is visible and scrollable (UX-DR10)

**Given** the user asks the AI to create or update a task (e.g. "create a task called Review PR due next Friday")
**When** the LLM identifies this as a tool call (`create_task` or `update_task`)
**Then** the AI executes the tool, shows confirmation with the educational note "The AI called the create_task Tool — Tools change server state, unlike Resources which are read-only" (UX-DR11)

**Given** the user asks a question the LLM cannot map to any MCP operation (e.g. "what's the weather?")
**When** the LLM responds
**Then** the AI explains that this MCP server only supports task management operations and suggests what the user can ask about

**Given** all previous Epic 4 panels (Resources, Tools, Prompts) are active
**When** the user interacts with the chat panel
**Then** the chat panel coexists with the manual panels; results from either can be viewed without interference; the user can switch freely between manual MCP interaction and AI-mediated interaction
