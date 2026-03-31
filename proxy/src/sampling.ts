const SAMPLING_TIMEOUT_MS = 30_000;

export async function handleSamplingRequest(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!Array.isArray(params.messages)) {
    throw new Error("messages is required and must be an array");
  }

  const mcpMessages = params.messages as Array<{
    role: string;
    content?: { type: string; text?: string };
  }>;
  const maxTokens = (params.maxTokens as number) ?? 500;

  const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434";
  const LLM_MODEL = process.env.LLM_MODEL || "llama3.1";
  const LLM_API_KEY = process.env.LLM_API_KEY || "";

  const chatMessages = mcpMessages.map((m) => ({
    role: m.role,
    content: m.content?.type === "text" ? m.content.text ?? "" : "",
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_API_KEY) headers["Authorization"] = `Bearer ${LLM_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SAMPLING_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`LLM returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { choices?: unknown }).choices)
  ) {
    throw new Error("Unexpected LLM response shape: missing choices array");
  }

  const choices = (data as { choices: Array<{ message?: { content?: string } }> }).choices;
  const text = choices[0]?.message?.content ?? "";

  return {
    role: "assistant",
    content: { type: "text", text },
    model: (data as { model?: string }).model ?? LLM_MODEL,
    stopReason: "endTurn",
  };
}
