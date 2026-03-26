const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3.1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";

export interface McpCapabilities {
  resources: Array<{ uri: string; name: string; description?: string }>;
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  prompts: Array<{
    name: string;
    description: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  }>;
}

export interface LlmOperation {
  type: "resource_read" | "tool_call" | "prompt_get" | "none";
  params: Record<string, unknown>;
}

export interface LlmInterpretResponse {
  explanation: string;
  operation: LlmOperation;
}

function buildSystemPrompt(capabilities: McpCapabilities): string {
  const resourceList = capabilities.resources
    .map((r) => `  - URI: ${r.uri} | Name: ${r.name}${r.description ? ` | ${r.description}` : ""}`)
    .join("\n");

  const toolList = capabilities.tools
    .map((t) => {
      const schema = JSON.stringify(t.inputSchema);
      return `  - Name: ${t.name} | ${t.description} | Schema: ${schema}`;
    })
    .join("\n");

  const promptList = capabilities.prompts
    .map((p) => {
      const args = p.arguments
        ? p.arguments.map((a) => `${a.name}${a.required ? " (required)" : ""}`).join(", ")
        : "none";
      return `  - Name: ${p.name} | ${p.description} | Args: ${args}`;
    })
    .join("\n");

  return `You are an MCP (Model Context Protocol) client assistant. Given a user's natural-language request, determine which MCP operation to execute.

Available MCP capabilities:

RESOURCES (read-only data, accessed by URI):
${resourceList || "  (none)"}

TOOLS (actions that can mutate state, invoked by name with arguments):
${toolList || "  (none)"}

PROMPTS (structured LLM-oriented content, invoked by name with optional arguments):
${promptList || "  (none)"}

Respond ONLY with a JSON object (no markdown fences, no extra text) in this exact format:
{
  "explanation": "A brief human-readable explanation of what you're doing and why",
  "operation": {
    "type": "resource_read" | "tool_call" | "prompt_get" | "none",
    "params": { ... }
  }
}

For resource_read: params must include "uri" (string).
For tool_call: params must include "name" (string) and "arguments" (object matching the tool's input schema).
For prompt_get: params must include "name" (string) and "arguments" (object with string values).
For none: params should be {} (empty object).

When the user references previous messages or results (e.g. "filter those", "now sort by deadline", "show me more details"), use the conversation history to determine what data or operation they are referring to. Choose the most appropriate MCP operation that fulfills their refined request.

If the user's request cannot be mapped to any task management MCP operation (e.g. "what's the weather?", "tell me a joke"), respond with:
{
  "explanation": "A helpful message explaining this server manages tasks and suggesting 2-3 things the user can ask about",
  "operation": { "type": "none", "params": {} }
}

Choose the most appropriate operation based on the user's intent. Prefer resources for read-only queries, tools for mutations or parameterised reads, and prompts for structured/summarised content.`;
}

function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }
  return JSON.parse(text.trim());
}

function validateOperation(parsed: unknown): LlmInterpretResponse {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response is not an object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.explanation !== "string") {
    throw new Error("LLM response missing 'explanation' string");
  }

  if (typeof obj.operation !== "object" || obj.operation === null) {
    throw new Error("LLM response missing 'operation' object");
  }

  const op = obj.operation as Record<string, unknown>;
  const validTypes = ["resource_read", "tool_call", "prompt_get", "none"];
  if (!validTypes.includes(op.type as string)) {
    throw new Error(`Invalid operation type: ${op.type}`);
  }

  if (typeof op.params !== "object" || op.params === null) {
    throw new Error("LLM response 'operation.params' must be an object");
  }

  const params = op.params as Record<string, unknown>;
  const opType = op.type as LlmOperation["type"];

  if (opType === "resource_read" && typeof params.uri !== "string") {
    throw new Error("resource_read operation requires a string 'uri' param");
  }
  if (opType === "tool_call" && typeof params.name !== "string") {
    throw new Error("tool_call operation requires a string 'name' param");
  }
  if (opType === "prompt_get" && typeof params.name !== "string") {
    throw new Error("prompt_get operation requires a string 'name' param");
  }
  // "none" type requires no param validation

  return {
    explanation: obj.explanation as string,
    operation: { type: opType, params },
  };
}

export async function interpretWithLlm(
  message: string,
  history: Array<{ role: string; content: string }>,
  capabilities: McpCapabilities,
): Promise<LlmInterpretResponse> {
  const systemPrompt = buildSystemPrompt(capabilities);

  const safeHistory = history.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const messages = [
    { role: "system", content: systemPrompt },
    ...safeHistory,
    { role: "user", content: message },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (LLM_API_KEY) {
    headers["Authorization"] = `Bearer ${LLM_API_KEY}`;
  }

  let response: Response;
  try {
    response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.1,
      }),
    });
  } catch {
    throw new Error(
      `LLM provider unreachable at ${LLM_BASE_URL}. Ensure Ollama is running.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `LLM provider returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error("LLM provider returned non-JSON response");
  }

  const choices = data.choices as Array<{
    message: { content: string };
  }>;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("LLM returned an empty response");
  }

  const content = choices[0].message?.content;
  console.log("[LLM] Raw response content:\n", content);

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    throw new Error(
      `LLM returned an unstructured response. Raw content:\n${content}`,
    );
  }

  return validateOperation(parsed);
}

export async function gatherCapabilities(
  bridgeSend: (msg: Record<string, unknown>) => Promise<unknown>,
  nextId: () => number,
): Promise<McpCapabilities> {
  try {
    await bridgeSend({
      jsonrpc: "2.0",
      id: nextId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-llm-proxy", version: "1.0.0" },
      },
    });
  } catch {
    // Session may already be initialized by the browser client — continue
  }

  const [resourcesRes, toolsRes, promptsRes] = await Promise.all([
    bridgeSend({
      jsonrpc: "2.0",
      id: nextId(),
      method: "resources/list",
      params: {},
    }),
    bridgeSend({
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/list",
      params: {},
    }),
    bridgeSend({
      jsonrpc: "2.0",
      id: nextId(),
      method: "prompts/list",
      params: {},
    }),
  ]);

  const resources =
    ((resourcesRes as { result?: { resources?: unknown[] } }).result
      ?.resources as McpCapabilities["resources"]) ?? [];
  const tools =
    ((toolsRes as { result?: { tools?: unknown[] } }).result
      ?.tools as McpCapabilities["tools"]) ?? [];
  const prompts =
    ((promptsRes as { result?: { prompts?: unknown[] } }).result
      ?.prompts as McpCapabilities["prompts"]) ?? [];

  return { resources, tools, prompts };
}
