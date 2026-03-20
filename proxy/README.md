# todo-mcp-proxy

HTTP+SSE proxy that bridges browser clients to the MCP task-manager server over STDIO.

```
Browser ──HTTP POST /mcp──► Proxy ──STDIO──► MCP Server (task-manager)
Browser ◄──SSE GET /sse────◄ Proxy ◄──STDIO──◄ MCP Server (notifications)
```

## Prerequisites

The MCP server must be compiled before the proxy can spawn it:

```bash
# From the repo root
npm run build
```

## Install

```bash
cd proxy
npm install
```

## Start

**Development (hot-reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

The proxy starts on port **3001** by default.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |

Override the port:

```bash
PORT=4000 npm run dev
```

## Endpoints

### `POST /mcp` — JSON-RPC endpoint

Forwards MCP JSON-RPC 2.0 requests to the server over STDIO and returns the correlated response.

**Content-Type:** `application/json`

**Request body** — a standard JSON-RPC 2.0 request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

**Response body** — the JSON-RPC 2.0 response from the MCP server:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [...]
  }
}
```

**Error responses:**

| HTTP Status | Condition |
|-------------|-----------|
| `200` | Successful JSON-RPC response (including MCP-level errors) |
| `400` | Malformed request (missing `jsonrpc`, `method`, or `id`) |
| `502` | Server timeout or internal proxy error |
| `503` | MCP server child process is not alive |

All error responses use JSON-RPC error format:

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": { "code": -32603, "message": "MCP server is not available" }
}
```

### `GET /sse` — Server-Sent Events

Streams MCP server-initiated notifications (JSON-RPC messages without an `id`) to connected browser clients.

**Event format:**

- **Event name:** `message`
- **Data:** complete JSON-RPC notification object

```
event: message
data: {"jsonrpc":"2.0","method":"notifications/resources/updated","params":{}}
```

An initial `:ok` comment is sent on connection to confirm the stream is live.

Browser clients connect using the standard `EventSource` API:

```javascript
const es = new EventSource("http://localhost:3001/sse");
es.addEventListener("message", (e) => {
  const notification = JSON.parse(e.data);
  console.log("MCP notification:", notification);
});
```

### `GET /health` — Health check

Returns the proxy and server status.

```json
{
  "status": "ok",
  "serverAlive": true
}
```

`serverAlive` is `false` when the MCP server child process has exited.
