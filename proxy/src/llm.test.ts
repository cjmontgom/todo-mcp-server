import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type McpCapabilities } from "./llm.js";

const emptyCaps: McpCapabilities = { resources: [], tools: [], prompts: [] };

describe("buildSystemPrompt", () => {
  it("includes task-creation tool selection policy and MCP tool names", () => {
    const prompt = buildSystemPrompt(emptyCaps);
    expect(prompt).toContain("create_task");
    expect(prompt).toContain("create_task_using_sampling");
    expect(prompt).toContain("Task creation — which tool?");
    expect(prompt).toMatch(/vague|meaningful description|title-only|enrichment/i);
    expect(prompt).toMatch(/materially present|enough detail/i);
    expect(prompt).toMatch(/Never use create_task_using_sampling/);
    expect(prompt).toMatch(/complete task details/);
  });
});
