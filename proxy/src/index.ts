import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { McpServerBridge } from "./spawnMcpServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);
const SERVER_PATH = path.resolve(__dirname, "../../build/index.js");

const app = express();
app.use(cors());
app.use(express.json());

const bridge = new McpServerBridge();
const sseClients = new Set<express.Response>();

bridge.on("notification", (msg: unknown) => {
  const data = JSON.stringify(msg);
  for (const client of sseClients) {
    try {
      client.write(`event: message\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
});

bridge.on("exit", (code: number | null) => {
  console.error(`MCP server exited with code ${code}`);
  const errorEvent = JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/server/exit",
    params: { code },
  });
  for (const client of sseClients) {
    try {
      client.write(`event: message\ndata: ${errorEvent}\n\n`);
      client.end();
    } catch {
      /* client already gone */
    }
  }
  sseClients.clear();
});

bridge.on("error", (err: Error) => {
  console.error("MCP server bridge error:", err.message);
});

app.post("/mcp", async (req, res) => {
  const body = req.body;
  if (!body || body.jsonrpc !== "2.0" || !body.method || body.id == null) {
    res.status(400).json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request" },
    });
    return;
  }

  if (!bridge.isAlive) {
    res.status(503).json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32603, message: "MCP server is not available" },
    });
    return;
  }

  try {
    const response = await bridge.send(body);
    res.json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal proxy error";
    res.status(502).json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32603, message },
    });
  }
});

app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(":ok\n\n");

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", serverAlive: bridge.isAlive });
});

bridge.start(SERVER_PATH);

const httpServer = app.listen(PORT, () => {
  console.log(`MCP proxy listening on http://localhost:${PORT}`);
  console.log(`  POST /mcp    — JSON-RPC endpoint`);
  console.log(`  GET  /sse    — Server-Sent Events`);
  console.log(`  GET  /health — Health check`);
});

httpServer.on("error", (err: Error) => {
  console.error(`HTTP server error: ${err.message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down...`);
    bridge.kill();
    for (const client of sseClients) {
      try { client.end(); } catch { /* noop */ }
    }
    sseClients.clear();
    httpServer.close(() => process.exit(0));
  });
}
