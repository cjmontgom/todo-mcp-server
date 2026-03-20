# Story 3.1: Build HTTP+SSE proxy that bridges browser to MCP server over STDIO

Status: done

## Story

As a browser-based MCP client developer,
I want a proxy process that accepts HTTP requests and SSE connections from the browser and forwards MCP JSON-RPC to the task-manager server over STDIO,
so that the browser can use all MCP capabilities without needing native STDIO support.

## Acceptance Criteria

1. **AC1 — Proxy spawns MCP server as child process**
   Given the proxy is started (e.g. `cd proxy && npm run dev`)
   When it initialises
   Then it spawns the compiled MCP server (`node ../build/index.js`) as a child process connected via STDIO

2. **AC2 — HTTP endpoint forwards JSON-RPC to server and returns response**
   Given the proxy is running and the MCP server child process is alive
   When a browser client sends a valid MCP JSON-RPC request (e.g. `resources/list`) to `POST /mcp`
   Then the proxy forwards the message to the server over STDIO and returns the server's JSON-RPC response to the browser

3. **AC3 — SSE endpoint streams server-initiated messages**
   Given the proxy is running
   When a browser client opens an SSE connection to `GET /sse`
   Then the proxy streams server-initiated MCP messages (notifications) back to the browser over SSE

4. **AC4 — Desktop STDIO clients unaffected**
   Given Claude Desktop and Cursor are configured to use the MCP server via STDIO
   When the proxy is also running
   Then desktop clients continue to communicate directly with the server via their own STDIO channel; proxy has no effect on them (FR16)

5. **AC5 — Child process exit handled gracefully**
   Given the proxy HTTP and SSE endpoints are running
   When the server child process exits unexpectedly
   Then the proxy logs an error and returns an appropriate error response to connected browser clients (no silent failure)

6. **AC6 — Client .env.example exists**
   Given a `.env.example` file exists in `client/` with `VITE_MCP_PROXY_URL=http://localhost:3001`
   When a developer sets up the project
   Then they can configure the React app to point to the proxy

7. **AC7 — Proxy routes documented**
   And proxy routes (HTTP endpoint path, SSE endpoint path, port) are documented in `proxy/README.md`, including:
   - The exact HTTP endpoint path and method (`POST /mcp`)
   - The exact SSE endpoint path (`GET /sse`)
   - The SSE event format (event name, data shape)
   - The default port (3001) and how to override it via `PORT` env var

## Tasks / Subtasks

- [x] Task 1: Scaffold `proxy/` package (AC: #1, #7)
  - [x] 1.1 Create `proxy/package.json` with name `todo-mcp-proxy`, `"type": "module"`, scripts `dev` and `build`
  - [x] 1.2 Create `proxy/tsconfig.json` targeting ES2022, Node16 module resolution, outDir `./build`, rootDir `./src`
  - [x] 1.3 Install dependencies: `express`, `cors` (runtime); `@types/express`, `@types/cors`, `typescript`, `tsx` (dev)
  - [x] 1.4 Create `proxy/src/` directory
- [x] Task 2: Implement child process spawning (AC: #1, #5)
  - [x] 2.1 Create `proxy/src/spawnMcpServer.ts` — exports a function that spawns `node` with `["../build/index.js"]` using `child_process.spawn` with `{ stdio: ["pipe", "pipe", "pipe"] }`
  - [x] 2.2 Parse stdout line-by-line using `readline.createInterface` — each line is a JSON-RPC message
  - [x] 2.3 Route incoming JSON-RPC messages: if message has `id`, resolve the pending request; if no `id`, it's a notification — forward to SSE clients
  - [x] 2.4 Capture stderr and log to proxy console (server uses `console.error` for logging)
  - [x] 2.5 Handle child `exit` and `error` events: log, mark server as unavailable, reject pending requests
- [x] Task 3: Implement Express HTTP server with `POST /mcp` (AC: #2)
  - [x] 3.1 Create `proxy/src/index.ts` — Express app with `cors()` and `express.json()` middleware
  - [x] 3.2 Implement `POST /mcp` handler: validate JSON-RPC structure, write to child stdin as newline-delimited JSON, wait for correlated response (match by `id`), return as HTTP JSON response
  - [x] 3.3 Add request timeout (30s default) — if server doesn't respond, return JSON-RPC error
  - [x] 3.4 If server child is not alive, return HTTP 503 with JSON-RPC error body
- [x] Task 4: Implement SSE endpoint `GET /sse` (AC: #3)
  - [x] 4.1 Implement `GET /sse` handler: set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - [x] 4.2 Register SSE client in a `Set<Response>` for broadcasting notifications
  - [x] 4.3 On server notification (JSON-RPC message without `id`), write `event: message\ndata: <JSON>\n\n` to all SSE clients
  - [x] 4.4 On client disconnect (`req.on("close")`), remove from the SSE set
  - [x] 4.5 Send initial SSE comment (`:ok\n\n`) on connection to confirm stream is live
- [x] Task 5: Add health and lifecycle endpoints (AC: #5)
  - [x] 5.1 `GET /health` — returns `{ status: "ok", serverAlive: boolean }`
  - [x] 5.2 On `SIGINT` / `SIGTERM`, kill child process and close HTTP server gracefully
- [x] Task 6: Create `proxy/README.md` (AC: #7)
  - [x] 6.1 Document: purpose, prerequisites (`npm run build` in root first), install, start commands
  - [x] 6.2 Document: `POST /mcp` — method, content-type, request body shape (JSON-RPC 2.0), response shape
  - [x] 6.3 Document: `GET /sse` — SSE event format: event name is `message`, data is JSON-RPC notification object
  - [x] 6.4 Document: default port 3001, override with `PORT` env var
  - [x] 6.5 Document: `GET /health` endpoint
- [x] Task 7: Create `client/.env.example` (AC: #6)
  - [x] 7.1 Create `client/` directory (if not exists) with a `.env.example` containing `VITE_MCP_PROXY_URL=http://localhost:3001`
- [x] Task 8: Build and verify (AC: all)
  - [x] 8.1 Run `cd proxy && npm install && npm run build` — zero TypeScript errors
  - [x] 8.2 Run `npm run build` in root to compile MCP server
  - [x] 8.3 Run `cd proxy && npm run dev` — verify proxy starts and spawns MCP server
  - [x] 8.4 Send `curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'` — verify JSON-RPC response
  - [x] 8.5 Send `curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}'` — verify resource list returned
  - [x] 8.6 Verify `GET /health` returns ok
  - [x] 8.7 Verify desktop STDIO usage unchanged (existing Claude Desktop / Cursor config still works)

## Dev Notes

### Architecture Overview

This story creates the first new package in the repo: `proxy/`. The proxy is a thin HTTP bridge — it owns process lifecycle and byte forwarding only. Zero task domain logic.

```
Browser ──HTTP POST /mcp──► Proxy ──STDIO──► MCP Server (task-manager)
Browser ◄──SSE GET /sse────◄ Proxy ◄──STDIO──◄ MCP Server (notifications)
```

The proxy does NOT embed an MCP server or client SDK. It forwards raw JSON-RPC messages between HTTP and STDIO.

### Wire Format: MCP over STDIO

The MCP server uses **newline-delimited JSON-RPC** over STDIO:
- Each message is a complete JSON-RPC 2.0 object on a single line
- Messages are separated by `\n`
- Three message types: **request** (has `method` + `id`), **response** (has `result` or `error` + `id`), **notification** (has `method`, no `id`)

The proxy writes to the child's stdin and reads from stdout using this framing. Stderr is for server logs only (e.g. `"Task Manager MCP Server running on stdio"`).

### MCP Initialization Handshake

The first request from the browser MUST be `initialize` (MCP protocol requirement). The proxy forwards it transparently. The browser is responsible for sending `initialize` before any other requests. The proxy does not manage initialization state — it's a transparent forwarder.

For MVP with a single browser client, this is sufficient. Multiple simultaneous browser clients sharing one server STDIO connection is out of scope.

### Request-Response Correlation

JSON-RPC uses `id` fields to correlate requests with responses. The proxy maintains a `Map<number | string, PendingRequest>` to match incoming server responses to the original HTTP request that triggered them.

```typescript
interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}
```

When `POST /mcp` receives a JSON-RPC request:
1. Extract the `id` from the request body
2. Store a pending entry keyed by `id`
3. Write the JSON-RPC message + `\n` to child stdin
4. Wait for the corresponding response (or timeout)
5. Return the response as HTTP JSON

### CORS

Enable CORS for all origins in development (`cors()` with defaults). The React app on `localhost:5173` needs to reach the proxy on `localhost:3001`.

### SSE Event Format

SSE messages use the standard format:
```
event: message
data: {"jsonrpc":"2.0","method":"notifications/resources/updated","params":{}}

```

The event name is always `message`. The data is the complete JSON-RPC notification object. Browser clients parse with `EventSource` API.

### Error Responses

When the proxy cannot forward a request (server dead, timeout, malformed input), it returns a JSON-RPC error response:
```json
{
  "jsonrpc": "2.0",
  "id": <original-id-or-null>,
  "error": {
    "code": -32603,
    "message": "MCP server is not available"
  }
}
```

HTTP status codes:
- `200` for all successful JSON-RPC responses (including MCP-level errors)
- `503` when the child process is not alive
- `400` for malformed requests (missing `jsonrpc`, `method`, or `id`)

### Files to Create

| File | Purpose |
|------|---------|
| `proxy/package.json` | Package manifest with deps and scripts |
| `proxy/tsconfig.json` | TypeScript config |
| `proxy/src/index.ts` | Express HTTP server, SSE endpoint, lifecycle |
| `proxy/src/spawnMcpServer.ts` | Child process management, STDIO message parsing, request correlation |
| `proxy/README.md` | Proxy documentation |
| `client/.env.example` | React app env var template |

### Files NOT to Modify

- `src/index.ts` — MCP server is unchanged (FR16, NFR2)
- `package.json` (root) — server package unchanged
- Any existing files in the repo

### Project Structure Compliance

| Rule | Requirement |
|------|-------------|
| **New package** | `proxy/` at repo root — separate from server `src/` and future `client/` |
| **Own package.json** | Proxy has its own deps; does not add deps to root |
| **Entry point** | `proxy/src/index.ts` per architecture spec |
| **No domain logic** | Proxy forwards JSON-RPC bytes only — no task awareness |
| **Server unchanged** | STDIO transport, existing resources/tools/prompts untouched |
| **Port** | Default 3001, configurable via `PORT` env var |

### package.json Spec

```json
{
  "name": "todo-mcp-proxy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node build/index.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "typescript": "^5.7.2",
    "tsx": "^4.19.0"
  }
}
```

**Important:** Use `npm install` to resolve actual latest versions. Do NOT hardcode versions from this spec — they are approximate. The dev uses `tsx watch` for hot-reload during development.

### tsconfig.json Spec

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

Matches the root server `tsconfig.json` conventions.

### spawnMcpServer.ts — Implementation Guide

```typescript
import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { EventEmitter } from "events";

interface PendingRequest {
  resolve: (msg: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class McpServerBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private pending = new Map<string | number, PendingRequest>();
  private alive = false;

  get isAlive() { return this.alive; }

  start(serverPath: string): void {
    this.process = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.alive = true;

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => {
      let msg: any;
      try { msg = JSON.parse(line); } catch { return; }

      if ("id" in msg && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          entry.resolve(msg);
          this.pending.delete(msg.id);
        }
      } else {
        this.emit("notification", msg);
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[mcp-server] ${chunk}`);
    });

    this.process.on("exit", (code) => {
      this.alive = false;
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("MCP server exited"));
        this.pending.delete(id);
      }
      this.emit("exit", code);
    });

    this.process.on("error", (err) => {
      this.alive = false;
      this.emit("error", err);
    });
  }

  async send(jsonRpcMessage: any, timeoutMs = 30000): Promise<unknown> {
    if (!this.alive || !this.process?.stdin?.writable) {
      throw new Error("MCP server is not available");
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(jsonRpcMessage.id);
        reject(new Error("Request timed out"));
      }, timeoutMs);

      this.pending.set(jsonRpcMessage.id, { resolve, reject, timer });
      this.process!.stdin!.write(JSON.stringify(jsonRpcMessage) + "\n");
    });
  }

  kill(): void {
    this.process?.kill();
  }
}
```

Key behaviors:
- `start(serverPath)` spawns the child process and wires up STDIO parsing
- `send(msg)` writes a JSON-RPC message and returns a promise that resolves when the correlated response arrives
- Notifications (no `id`) are emitted as `"notification"` events for SSE broadcasting
- Timeouts prevent leaked promises if the server hangs
- Child exit rejects all pending requests

### index.ts — Implementation Guide

```typescript
import express from "express";
import cors from "cors";
import { McpServerBridge } from "./spawnMcpServer.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);
const SERVER_PATH = path.resolve(__dirname, "../../build/index.js");

const app = express();
app.use(cors());
app.use(express.json());

const bridge = new McpServerBridge();
const sseClients = new Set<express.Response>();

bridge.on("notification", (msg) => {
  const data = JSON.stringify(msg);
  for (const client of sseClients) {
    client.write(`event: message\ndata: ${data}\n\n`);
  }
});

bridge.on("exit", (code) => {
  console.error(`MCP server exited with code ${code}`);
});

// POST /mcp — forward JSON-RPC to MCP server
app.post("/mcp", async (req, res) => {
  const body = req.body;
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request" },
    });
  }

  if (!bridge.isAlive) {
    return res.status(503).json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32603, message: "MCP server is not available" },
    });
  }

  try {
    const response = await bridge.send(body);
    res.json(response);
  } catch (err: any) {
    res.status(502).json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32603, message: err.message || "Internal proxy error" },
    });
  }
});

// GET /sse — server-sent events for notifications
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(":ok\n\n");

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", serverAlive: bridge.isAlive });
});

// Start
bridge.start(SERVER_PATH);

const httpServer = app.listen(PORT, () => {
  console.log(`MCP proxy listening on http://localhost:${PORT}`);
  console.log(`  POST /mcp    — JSON-RPC endpoint`);
  console.log(`  GET  /sse    — Server-Sent Events`);
  console.log(`  GET  /health — Health check`);
});

// Graceful shutdown
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down...`);
    bridge.kill();
    httpServer.close();
    process.exit(0);
  });
}
```

### Anti-Patterns to Avoid

1. **Do NOT install `@modelcontextprotocol/sdk` in the proxy** — the proxy forwards raw JSON-RPC, it doesn't parse MCP semantics
2. **Do NOT add any task-related logic to the proxy** — no awareness of resources, tools, or prompts
3. **Do NOT modify `src/index.ts`** — the MCP server is unchanged in this story
4. **Do NOT add proxy dependencies to root `package.json`** — proxy has its own package
5. **Do NOT use WebSocket** — architecture specifies HTTP + SSE; keep it simple
6. **Do NOT manage MCP `initialize` state in the proxy** — forward it transparently; the browser client is responsible for the handshake
7. **Do NOT assume multiple browser clients** — MVP supports one concurrent client sharing the STDIO connection
8. **Do NOT use `process.stdout` for proxy logging** — use `console.log` (goes to stderr by default for `tsx`) or explicitly `console.error`; stdout might conflict if testing
9. **Do NOT hardcode dependency versions** — use `npm install <package>` to get latest

### Known Alternative: `mcp-proxy` npm Package

The [`mcp-proxy`](https://www.npmjs.com/package/mcp-proxy) package (v6.4.4, 326K weekly downloads) provides an off-the-shelf STDIO-to-HTTP/SSE bridge with `npx mcp-proxy --port 3001 -- node build/index.js`. The architecture calls for a custom `proxy/` package to maintain control over the HTTP API surface, keep educational value, and prepare for the Epic 5 LLM endpoint (`POST /llm/interpret`) which will be added to this same proxy later.

### Express 5 Note

Express 5.x is the latest stable release. It natively returns rejected promise errors as 500 responses, so async route handlers work without `express-async-errors`. If `npm install express` resolves to v4.x on the user's machine, the code still works — the only difference is you'd need to add `.catch(next)` to async handlers or use a wrapper.

## Previous Story Intelligence

**From Story 2.2 (most recent, done):**
- Single-file server pattern (`src/index.ts`) — 647 lines, all resources/tools/prompts in one file
- Server logs to stderr: `console.error("Task Manager MCP Server running on stdio")` — proxy must capture stderr separately from stdout
- Build: `npm run build` (tsc → `build/index.js`) — proxy must run AFTER server is built
- Commit convention: `feat: <description> (Story X.Y)`

**From Stories 1.1–2.2 overall:**
- Server uses `@modelcontextprotocol/sdk ^1.1.0`
- `StdioServerTransport` used by the server — reads from stdin, writes to stdout
- The server outputs JSON-RPC to stdout and debug logs to stderr
- No HTTP capability exists in the server — this is the proxy's job
- In-memory `Map<string, Task>` persists only for the process lifetime — restarting the proxy (which restarts the server child) resets all tasks
- Build output is `build/index.js` — the proxy spawns `node ../build/index.js` (relative to proxy dir) or an absolute path

**Tech debt items (from `tech-debt.md`):**
- TD-3: `update_task_status` doesn't validate status server-side — not proxy-relevant but worth knowing
- No items affect this story

## Architecture & Pattern Compliance

| Area | Decision |
|------|----------|
| **Package location** | `proxy/` at repo root — per architecture spec |
| **Entry point** | `proxy/src/index.ts` — per architecture project structure |
| **Transport: proxy→server** | STDIO (`child_process.spawn`) |
| **Transport: browser→proxy** | HTTP (`POST /mcp`) + SSE (`GET /sse`) |
| **Port** | 3001 (configurable via `PORT`) |
| **CORS** | Enabled for all origins (dev only) |
| **Server unmodified** | FR16, NFR2 — STDIO unchanged |
| **Naming** | camelCase files (`spawnMcpServer.ts`), PascalCase classes (`McpServerBridge`) |
| **No domain logic** | Proxy is a transport bridge only |

## Tech Stack Reference

| Item | Value |
|------|-------|
| Language | TypeScript 5.x, ESM (`"type": "module"`) |
| HTTP framework | Express (latest stable) |
| CORS | `cors` package |
| Child process | Node.js `child_process.spawn` |
| STDIO parsing | Node.js `readline.createInterface` |
| Dev runner | `tsx watch` (hot-reload) |
| Build | `tsc` → `build/` |
| Default port | 3001 |

## Git Intelligence

**Recent commits (newest first):**
1. `3b9c5f0` — feat: add stakeholder summary and completions-by-date prompts (Story 2.2)
2. `0772368` — docs: add MCP sampling stretch goal note to Epic 5
3. `d276d13` — chore: mark Epic 1 done and Story 2.1 done in sprint status
4. `4c8ee38` — feat: add prompts capability and tasks_table prompt (Story 2.1)
5. `40f0059` — feat: add markdown table resources and shared table helper (Story 1.3)

**Convention:** `feat:` prefix for features; story reference in parentheses.

**Suggested commit message:** `feat: add HTTP+SSE proxy bridging browser to MCP server (Story 3.1)`

## Verification Steps

After building and starting:

1. **Build MCP server:** `npm run build` (in root) — must succeed first
2. **Install proxy deps:** `cd proxy && npm install` — no errors
3. **Build proxy:** `cd proxy && npm run build` — zero TypeScript errors
4. **Start proxy:** `cd proxy && npm run dev` — log shows `MCP proxy listening on http://localhost:3001` and `[mcp-server] Task Manager MCP Server running on stdio`
5. **Health check:** `curl http://localhost:3001/health` → `{"status":"ok","serverAlive":true}`
6. **Initialize:** `curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0.0"}}}'` → JSON-RPC response with server capabilities
7. **List resources:** `curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}'` → response listing all 7 resources
8. **List tools:** Same pattern with `"method":"tools/list"` → response listing all 5 tools
9. **List prompts:** Same pattern with `"method":"prompts/list"` → response listing all 3 prompts
10. **Read a resource:** `curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"task://table/all"}}'` → markdown table
11. **SSE connection:** `curl -N http://localhost:3001/sse` → receives `:ok` comment (stays open)
12. **Server dead:** Kill the child process → subsequent `POST /mcp` returns 503 with error
13. **Desktop unchanged:** Claude Desktop / Cursor config that uses `node build/index.js` directly still works (proxy is a separate process)
14. **Files exist:** `proxy/README.md` documents endpoints; `client/.env.example` has `VITE_MCP_PROXY_URL`

## Definition of Done

- [ ] `proxy/` directory exists with own `package.json`, `tsconfig.json`, `src/index.ts`, `src/spawnMcpServer.ts`
- [ ] `proxy/README.md` documents `POST /mcp`, `GET /sse`, `GET /health`, port config
- [ ] `client/.env.example` exists with `VITE_MCP_PROXY_URL=http://localhost:3001`
- [ ] Proxy spawns MCP server as child process via STDIO
- [ ] `POST /mcp` forwards JSON-RPC requests and returns correlated responses
- [ ] `GET /sse` streams server notifications to connected clients
- [ ] `GET /health` returns server alive status
- [ ] Child process exit is handled: logged, pending requests rejected, 503 returned
- [ ] CORS enabled for local development
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] `npm run build` in proxy completes with zero TypeScript errors
- [ ] No changes to `src/index.ts` or root `package.json`
- [ ] Desktop STDIO clients are unaffected

## Dev Agent Record

### Agent Model Used

Claude claude-4.6-opus (via Cursor)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Created `proxy/` package as a standalone Node.js/TypeScript project with its own `package.json` and `tsconfig.json`
- Implemented `McpServerBridge` class in `spawnMcpServer.ts` using `child_process.spawn` with STDIO pipes, `readline` for line-delimited JSON-RPC parsing, and `Map<id, PendingRequest>` for request-response correlation with 30s timeout
- Implemented Express HTTP server in `index.ts` with three endpoints: `POST /mcp` (JSON-RPC forwarding), `GET /sse` (server-sent events for notifications), `GET /health` (status check)
- Input validation returns 400 for malformed JSON-RPC, 503 when server child is dead, 502 on timeout/proxy errors
- SSE broadcasts notifications (JSON-RPC messages without `id`) to all connected clients using `event: message` format
- Graceful shutdown on SIGINT/SIGTERM kills child process and closes HTTP server
- CORS enabled for all origins (dev mode)
- Created comprehensive `proxy/README.md` documenting all endpoints, configuration, and SSE event format
- Created `client/.env.example` with `VITE_MCP_PROXY_URL=http://localhost:3001`
- All verification tests passed: health check, initialize, resources/list (7 resources), tools/list (5 tools), prompts/list (3 prompts), resource read, SSE connection
- Zero TypeScript errors in both root and proxy builds
- No changes to `src/index.ts` or root `package.json` — desktop STDIO clients unaffected

### Change Log

- 2026-03-20: Implemented Story 3.1 — HTTP+SSE proxy bridging browser to MCP server over STDIO

### File List

- `proxy/package.json` (new)
- `proxy/tsconfig.json` (new)
- `proxy/src/spawnMcpServer.ts` (new)
- `proxy/src/index.ts` (new)
- `proxy/README.md` (new)
- `client/.env.example` (new)
