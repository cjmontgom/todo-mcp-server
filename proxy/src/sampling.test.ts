import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleSamplingRequest } from "./sampling.js";

const originalFetch = globalThis.fetch;

describe("handleSamplingRequest", () => {
  beforeEach(() => {
    process.env.LLM_BASE_URL = "http://localhost:11434";
    process.env.LLM_MODEL = "test-model";
    process.env.LLM_API_KEY = "";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
  });

  it("maps MCP messages to OpenAI format and returns MCP result", async () => {
    const mockLlmResponse = {
      choices: [{ message: { content: '{"title": "Better title"}' } }],
      model: "test-model",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLlmResponse),
    });

    const result = await handleSamplingRequest({
      messages: [
        {
          role: "user",
          content: { type: "text", text: "Enrich this task" },
        },
      ],
      maxTokens: 300,
    });

    expect(result).toEqual({
      role: "assistant",
      content: { type: "text", text: '{"title": "Better title"}' },
      model: "test-model",
      stopReason: "endTurn",
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("http://localhost:11434/v1/chat/completions");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages).toEqual([
      { role: "user", content: "Enrich this task" },
    ]);
    expect(body.max_tokens).toBe(300);
    expect(body.model).toBe("test-model");
  });

  it("throws on non-ok HTTP response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      handleSamplingRequest({
        messages: [
          { role: "user", content: { type: "text", text: "test" } },
        ],
        maxTokens: 100,
      })
    ).rejects.toThrow("LLM returned HTTP 500");
  });

  it("uses LLM_API_KEY in Authorization header when set", async () => {
    process.env.LLM_API_KEY = "test-key-123";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "response" } }],
          model: "test-model",
        }),
    });

    await handleSamplingRequest({
      messages: [
        { role: "user", content: { type: "text", text: "test" } },
      ],
      maxTokens: 100,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers["Authorization"]).toBe("Bearer test-key-123");
  });

  it("defaults maxTokens to 500 when not provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" } }],
        }),
    });

    await handleSamplingRequest({
      messages: [
        { role: "user", content: { type: "text", text: "test" } },
      ],
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.max_tokens).toBe(500);
  });

  it("preserves maxTokens of 0 (does not coerce to 500)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" } }],
        }),
    });

    await handleSamplingRequest({
      messages: [
        { role: "user", content: { type: "text", text: "test" } },
      ],
      maxTokens: 0,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.max_tokens).toBe(0);
  });

  it("throws when messages is missing", async () => {
    await expect(
      handleSamplingRequest({})
    ).rejects.toThrow("messages is required and must be an array");
  });

  it("throws when messages is not an array", async () => {
    await expect(
      handleSamplingRequest({ messages: "not an array" })
    ).rejects.toThrow("messages is required and must be an array");
  });

  it("throws on unexpected LLM response shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: "something went wrong" }),
    });

    await expect(
      handleSamplingRequest({
        messages: [
          { role: "user", content: { type: "text", text: "test" } },
        ],
      })
    ).rejects.toThrow("Unexpected LLM response shape");
  });

  it("handles message with missing content gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" } }],
        }),
    });

    await handleSamplingRequest({
      messages: [
        { role: "user" },
      ],
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages).toEqual([{ role: "user", content: "" }]);
  });
});
