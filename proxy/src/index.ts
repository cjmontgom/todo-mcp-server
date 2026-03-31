import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { McpServerBridge } from "./spawnMcpServer.js";
import {
  interpretWithLlm,
  gatherCapabilities,
  type McpCapabilities,
} from "./llm.js";
import { handleSamplingRequest } from "./sampling.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);
const SERVER_PATH = path.resolve(__dirname, "../../build/index.js");

const app = express();
app.use(cors());
app.use(express.json());

const bridge = new McpServerBridge();
const sseClients = new Set<express.Response>();

let internalRequestId = 100000;
const nextInternalId = () => ++internalRequestId;
let capabilitiesPromise: Promise<McpCapabilities> | null = null;

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

bridge.on("serverRequest", async (msg: Record<string, unknown>) => {
  const method = msg.method as string;
  const id = msg.id as string | number;
  const params = msg.params as Record<string, unknown> | undefined;

  if (method === "sampling/createMessage") {
    try {
      const result = await handleSamplingRequest(params ?? {});
      bridge.respondToServer(id, result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Sampling failed";
      console.error(`[sampling] Error: ${errMsg}`);
      bridge.respondErrorToServer(id, -32603, errMsg);
    }
  } else {
    bridge.respondErrorToServer(id, -32601, `Unsupported server request: ${method}`);
  }
});

app.post("/mcp", async (req, res) => {
  let body = req.body;
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

  if (body.method === "initialize") {
    body = {
      ...body,
      params: {
        ...body.params,
        capabilities: {
          ...(body.params?.capabilities ?? {}),
          sampling: {},
        },
      },
    };
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

app.post("/llm/interpret", async (req, res) => {
  const { message, history } = req.body as {
    message?: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing required field: message" });
    return;
  }

  if (history !== undefined && !Array.isArray(history)) {
    res.status(400).json({ error: '"history" must be an array' });
    return;
  }

  if (!bridge.isAlive) {
    res.status(503).json({ error: "MCP server is not available" });
    return;
  }

  try {
    capabilitiesPromise ??= gatherCapabilities(
      (msg) => bridge.send(msg),
      nextInternalId,
    );
    let capabilities: McpCapabilities;
    try {
      capabilities = await capabilitiesPromise;
    } catch (err) {
      capabilitiesPromise = null;
      throw err;
    }

    const intent = await interpretWithLlm(
      message,
      history ?? [],
      capabilities,
    );

    const op = intent.operation;

    if (op.type === "none") {
      res.json({
        explanation: intent.explanation,
        operation: intent.operation,
        mcpResult: null,
      });
      return;
    }

    const toObj = (v: unknown) =>
      typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

    let mcpResult: unknown;

    if (op.type === "resource_read") {
      mcpResult = await bridge.send({
        jsonrpc: "2.0",
        id: nextInternalId(),
        method: "resources/read",
        params: { uri: op.params.uri },
      });
    } else if (op.type === "tool_call") {
      mcpResult = await bridge.send({
        jsonrpc: "2.0",
        id: nextInternalId(),
        method: "tools/call",
        params: { name: op.params.name, arguments: toObj(op.params.arguments) },
      });
    } else if (op.type === "prompt_get") {
      mcpResult = await bridge.send({
        jsonrpc: "2.0",
        id: nextInternalId(),
        method: "prompts/get",
        params: {
          name: op.params.name,
          arguments: toObj(op.params.arguments),
        },
      });
    } else {
      throw new Error(`Unexpected operation type: ${op.type}`);
    }

    const mcpError = (mcpResult as { error?: { message?: string } })?.error;
    if (mcpError) {
      throw new Error(
        `MCP operation failed: ${mcpError.message ?? JSON.stringify(mcpError)}`,
      );
    }

    res.json({
      explanation: intent.explanation,
      operation: intent.operation,
      mcpResult,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Internal proxy error";
    const isUnreachable = errorMessage.includes("unreachable");
    res.status(isUnreachable ? 503 : 502).json({ error: errorMessage });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", serverAlive: bridge.isAlive });
});

bridge.start(SERVER_PATH);

const httpServer = app.listen(PORT, () => {
  console.log(`MCP proxy listening on http://localhost:${PORT}`);
  console.log(`  POST /mcp            — JSON-RPC endpoint`);
  console.log(`  POST /llm/interpret  — LLM interpretation endpoint`);
  console.log(`  GET  /sse            — Server-Sent Events`);
  console.log(`  GET  /health         — Health check`);
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
