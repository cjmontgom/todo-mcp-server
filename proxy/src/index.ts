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

const SAMPLING_HUMAN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let currentSamplingMode: "human" | "ai" = "human";

interface PendingSamplingRequest {
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}
const pendingSamplingRequests = new Map<string | number, PendingSamplingRequest>();

function broadcastSSE(event: Record<string, unknown>): void {
  let data: string;
  try {
    data = JSON.stringify(event);
  } catch {
    console.error("[broadcastSSE] Failed to serialize event");
    return;
  }
  for (const client of sseClients) {
    try {
      client.write(`event: message\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

bridge.on("notification", (msg: unknown) => {
  broadcastSSE(msg as Record<string, unknown>);
});

bridge.on("exit", (code: number | null) => {
  console.error(`MCP server exited with code ${code}`);
  for (const [, p] of pendingSamplingRequests) {
    p.reject(new Error("MCP server exited"));
  }
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
  for (const [, p] of pendingSamplingRequests) {
    p.reject(new Error(`MCP server error: ${err.message}`));
  }
});

bridge.on("serverRequest", async (msg: Record<string, unknown>) => {
  const method = msg.method as string;
  const id = msg.id as string | number;
  const params = msg.params as Record<string, unknown> | undefined;

  if (method === "sampling/createMessage") {
    if (currentSamplingMode === "human") {
      broadcastSSE({
        type: "sampling-request",
        id,
        messages: params?.messages,
        maxTokens: params?.maxTokens,
      });

      const timer = setTimeout(() => {
        const p = pendingSamplingRequests.get(id);
        if (p) p.reject(new Error("Sampling request timed out — no human response received within 10 minutes"));
      }, SAMPLING_HUMAN_TIMEOUT_MS);

      pendingSamplingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          pendingSamplingRequests.delete(id);
          bridge.respondToServer(id, result);
        },
        reject: (err) => {
          clearTimeout(timer);
          pendingSamplingRequests.delete(id);
          broadcastSSE({ type: "sampling-request-error", id, error: err.message });
          bridge.respondErrorToServer(id, -32603, err.message);
        },
        timer,
      });
    } else {
      // AI mode: call Ollama + emit trace events
      broadcastSSE({
        type: "sampling-trace",
        step: "server-requested",
        data: { id, messages: params?.messages, maxTokens: params?.maxTokens },
      });
      broadcastSSE({
        type: "sampling-trace",
        step: "calling-ollama",
        data: { model: process.env.LLM_MODEL || "llama3.1" },
      });

      try {
        const result = await handleSamplingRequest(params ?? {});
        broadcastSSE({
          type: "sampling-trace",
          step: "ollama-responded",
          data: { text: (result.content as Record<string, unknown>)?.text ?? "" },
        });
        bridge.respondToServer(id, result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Sampling failed";
        console.error(`[sampling] Error: ${errMsg}`);
        bridge.respondErrorToServer(id, -32603, errMsg);
      }
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
    currentSamplingMode = "human";
    const response = await bridge.send(body, SAMPLING_HUMAN_TIMEOUT_MS + 30_000);
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

app.post("/mcp/sampling/respond", (req, res) => {
  const { id, response } = req.body as {
    id?: string | number;
    response?: Record<string, unknown>;
  };

  if (id == null || !response) {
    res.status(400).json({ error: "Missing required fields: id, response" });
    return;
  }

  if (typeof response !== "object" || !("role" in response) || !("content" in response)) {
    res.status(400).json({ error: "Response must include 'role' and 'content'" });
    return;
  }

  const normalizedId = typeof id === "string" && /^\d+$/.test(id) ? Number(id) : id;
  const pending = pendingSamplingRequests.get(normalizedId);
  if (!pending) {
    res
      .status(404)
      .json({ error: `No pending sampling request with id ${id}` });
    return;
  }

  pending.resolve(response);
  res.json({ ok: true });
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
      currentSamplingMode = "human";
      mcpResult = await bridge.send({
        jsonrpc: "2.0",
        id: nextInternalId(),
        method: "resources/read",
        params: { uri: op.params.uri },
      });
    } else if (op.type === "tool_call") {
      currentSamplingMode = op.params.name === "create_task_using_sampling" ? "ai" : "human";
      mcpResult = await bridge.send({
        jsonrpc: "2.0",
        id: nextInternalId(),
        method: "tools/call",
        params: { name: op.params.name, arguments: toObj(op.params.arguments) },
      });
      if (
        op.params.name === "create_task_using_sampling" &&
        !(mcpResult as Record<string, unknown>)?.error
      ) {
        broadcastSSE({
          type: "sampling-trace",
          step: "enrichment-applied",
          data: { result: mcpResult as Record<string, unknown> },
        });
      }
    } else if (op.type === "prompt_get") {
      currentSamplingMode = "human";
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
  console.log(`  POST /mcp                    — JSON-RPC endpoint (human mode)`);
  console.log(`  POST /mcp/sampling/respond   — Human-in-the-loop sampling response`);
  console.log(`  POST /llm/interpret          — LLM interpretation endpoint (AI mode)`);
  console.log(`  GET  /sse                    — Server-Sent Events`);
  console.log(`  GET  /health                 — Health check`);
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
