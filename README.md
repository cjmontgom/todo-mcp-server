# MCP Task Manager – Educational React Client

An educational full-stack project that extends a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) task-manager server with a React front-end that teaches MCP concepts hands-on. The React app acts as an MCP client, exposing **Resources**, **Tools**, and **Prompts** in a single UI with in-app explanations. [AG Grid](https://www.ag-grid.com/) is the primary way tabular data is displayed, making this simultaneously a learning exercise for both MCP and AG Grid.

## Architecture

```
┌─────────────────────────────────────┐
│           MCP Clients               │
│  Claude Desktop  Cursor  React App  │
└────────┬──────────┬────────┬────────┘
         │          │        │
       STDIO      STDIO    HTTP/SSE
         │          │        │
         │       ┌──┴────────┴──┐
         │       │  HTTP Proxy  │  :3001
         │       │  (Node/tsx)  │
         │       └──────┬───────┘
         │              │ STDIO
         └──────────────┤
                 ┌──────┴───────┐
                 │  MCP Server  │
                 │  (Node/TS)   │
                 └──────────────┘
```

- **MCP Server** (`src/`) — TypeScript/Node, STDIO transport. Exposes Resources, Tools, and Prompts for task management with deadlines.
- **HTTP/SSE Proxy** (`proxy/`) — Spawns the MCP server as a subprocess and bridges it to the browser over HTTP + Server-Sent Events.
- **React App** (`client/`) — MCP client UI with AG Grid as the primary data presentation layer, educational copy, and a natural-language chat interface.

## Start Everything

First, build the MCP server (required once, or after server changes):

```bash
npm run build
```

Then start all three processes in parallel:

```bash
npm run dev
```

If you already have stale local processes from an earlier run, use:

```bash
npm run dev:clean
```

This kills anything currently bound to ports `3001` (proxy) and `5173` (client), then starts everything.

This runs:
| Process | URL | Description |
|---------|-----|-------------|
| MCP Server | — | Runs via STDIO (spawned by proxy) |
| HTTP/SSE Proxy | `http://localhost:3001` | Bridges browser ↔ MCP server |
| React Client | `http://localhost:5173` | Educational MCP client UI |

## Individual Start Commands

Run each in a separate terminal if you prefer:

```bash
# Terminal 1 – MCP server (STDIO, consumed by proxy)
npm run start

# Terminal 2 – HTTP/SSE proxy
npm run dev --prefix proxy

# Terminal 3 – React client
npm run dev --prefix client
```

#### Ollama Setup

The chat tab requires [Ollama](https://ollama.com/) running locally. If you skip this, the rest of the app works fine — only the AI chat tab is affected.

1. **Install Ollama:**

```bash
brew install ollama
```

Or download from [ollama.com/download](https://ollama.com/download) for other platforms.

2. **Start Ollama** (runs in the background on port 11434):

```bash
ollama serve
```

On macOS, Ollama may already be running as a menu bar app after installation. You can verify with:

```bash
curl http://localhost:11434/v1/models
```

3. **In a new terminal tab, pull Ollama's default model** 

```bash
ollama pull llama3.1
```

#### LLM Configuration

The proxy reads LLM settings from `proxy/.env`. Copy the example and edit as needed:

```bash
cp proxy/.env.example proxy/.env
```

The defaults point to Ollama (`http://localhost:11434`, model `llama3.1`). To use a different model or provider, just edit `proxy/.env` — any OpenAI-compatible API works (Ollama, OpenAI, Anthropic-compatible, etc.). See `proxy/.env.example` for examples.

## Configure with Claude Desktop

The MCP server works as a standalone app for use with other native MCP clients able to send STDIO, such as Claude desktop.

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "task-manager": {
      "command": "node",
      "args": ["/absolute/path/to/todo-mcp-server/build/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with your actual path.

## Key Learnings

1. **MCP separates concerns**: Resources are read-only data by URI; Tools are actions with schema-validated inputs; Prompts are pre-built server-generated messages.
2. **Transport is pluggable**: STDIO for native clients, HTTP/SSE for browsers (via proxy).
3. **Schema-driven UIs**: Tool input schemas can drive form generation directly in the client.
4. **AG Grid patterns**: Column defs, multiple data sources, client-side sort/filter — practised across every panel.
5. **LLM + MCP**: An LLM can interpret natural language and select MCP operations, acting as a reasoning layer on top of a structured protocol.
