const _proxyUrl = import.meta.env.VITE_MCP_PROXY_URL;
if (!_proxyUrl) {
  throw new Error(
    "[MCP] VITE_MCP_PROXY_URL is not set. Add it to client/.env:\n  VITE_MCP_PROXY_URL=http://localhost:3001"
  );
}
const BASE_URL: string = _proxyUrl;

let requestId = 0;
let initPromise: Promise<void> | null = null;

export interface Resource {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function sendJsonRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const id = ++requestId;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
  } catch {
    throw new Error(`Proxy unreachable at ${BASE_URL}. Is it running?`);
  }

  let data: JsonRpcResponse;
  try {
    data = (await response.json()) as JsonRpcResponse;
  } catch {
    throw new Error(`Proxy returned non-JSON response (HTTP ${response.status})`);
  }

  if (data.error) {
    throw new Error(data.error.message ?? `MCP error code ${data.error.code}`);
  }

  if (!response.ok) {
    throw new Error(`Proxy returned HTTP ${response.status}: ${response.statusText}`);
  }

  return data.result;
}

async function ensureInitialized(): Promise<void> {
  initPromise ??= sendJsonRpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mcp-learner", version: "1.0.0" },
  }).then(() => undefined);
  return initPromise;
}

export async function listResources(): Promise<Resource[]> {
  await ensureInitialized();
  const result = await sendJsonRpc("resources/list");
  if (!result || !Array.isArray((result as Record<string, unknown>).resources)) {
    throw new Error("Unexpected response shape from resources/list");
  }
  return (result as { resources: Resource[] }).resources;
}

export async function listTools(): Promise<Tool[]> {
  await ensureInitialized();
  const result = await sendJsonRpc("tools/list");
  if (!result || !Array.isArray((result as Record<string, unknown>).tools)) {
    throw new Error("Unexpected response shape from tools/list");
  }
  return (result as { tools: Tool[] }).tools;
}

export async function listPrompts(): Promise<Prompt[]> {
  await ensureInitialized();
  const result = await sendJsonRpc("prompts/list");
  if (!result || !Array.isArray((result as Record<string, unknown>).prompts)) {
    throw new Error("Unexpected response shape from prompts/list");
  }
  return (result as { prompts: Prompt[] }).prompts;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export async function readResource(uri: string): Promise<ResourceContent> {
  await ensureInitialized();
  const result = await sendJsonRpc("resources/read", { uri });
  const contents = (result as { contents: ResourceContent[] }).contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error(`Unexpected response shape from resources/read (uri: ${uri})`);
  }
  const item = contents[0];
  if (typeof item.text !== 'string' || typeof item.mimeType !== 'string') {
    throw new Error(`Malformed content item from resources/read (uri: ${uri})`);
  }
  return item;
}

export interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  await ensureInitialized();
  const result = await sendJsonRpc("tools/call", { name: toolName, arguments: args });
  const typed = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  if (!typed || !Array.isArray(typed.content)) {
    throw new Error(`Unexpected response shape from tools/call (tool: ${toolName})`);
  }
  return { content: typed.content, isError: typed.isError };
}

export interface SamplingResponseMessage {
  role: "assistant";
  model: string;
  content: {
    type: "text" | string;
    text?: string;
  };
}

export async function respondToSamplingRequest(payload: {
  id: string | number;
  response: SamplingResponseMessage;
}): Promise<{ ok: true }> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/mcp/sampling/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Proxy unreachable at ${BASE_URL}. Is it running?`);
  }

  let data: { ok?: boolean; error?: string } | undefined;
  try {
    data = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    throw new Error(`Proxy returned non-JSON response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(data?.error ?? "Sampling response payload was invalid.");
    }
    if (response.status === 404) {
      throw new Error(data?.error ?? "Sampling request not found or already resolved.");
    }
    throw new Error(data?.error ?? `Proxy returned HTTP ${response.status}: ${response.statusText}`);
  }

  if (!data?.ok) {
    throw new Error("Sampling response endpoint returned an unexpected payload.");
  }

  return { ok: true };
}

export interface PromptMessage {
  role: string;
  content: { type: string; text?: string };
}

export interface PromptResult {
  messages: PromptMessage[];
}

export async function getPrompt(
  promptName: string,
  args: Record<string, string>
): Promise<PromptResult> {
  await ensureInitialized();
  const result = await sendJsonRpc("prompts/get", { name: promptName, arguments: args });
  const typed = result as { messages?: PromptMessage[] };
  if (!typed || !Array.isArray(typed.messages)) {
    throw new Error(`Unexpected response shape from prompts/get (prompt: ${promptName})`);
  }
  return { messages: typed.messages };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmInterpretResult {
  explanation: string;
  operation: { type: string; params: Record<string, unknown> };
  mcpResult: unknown;
}

export async function interpretMessage(
  message: string,
  history: ChatMessage[],
): Promise<LlmInterpretResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/llm/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
  } catch {
    throw new Error(`Proxy unreachable at ${BASE_URL}. Is it running?`);
  }

  if (!response.ok) {
    let errorBody: { error?: string } | undefined;
    try {
      errorBody = (await response.json()) as { error?: string };
    } catch { /* non-JSON error response */ }
    throw new Error(
      errorBody?.error ?? `Proxy returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  let data: LlmInterpretResult;
  try {
    data = (await response.json()) as LlmInterpretResult;
  } catch {
    throw new Error(`Proxy returned non-JSON response (HTTP ${response.status})`);
  }

  return data;
}
