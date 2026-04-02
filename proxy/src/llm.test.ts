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

  it("includes guardrails for capability questions and task-creation gating", () => {
    const prompt = buildSystemPrompt(emptyCaps);
    expect(prompt).toContain("Guardrails for capability and meta questions:");
    expect(prompt).toContain(
      'If the user asks what tools/resources/prompts/capabilities are available',
    );
    expect(prompt).toContain('Return operation.type = "none"');
    expect(prompt).toContain(
      "Never call create_task or create_task_using_sampling unless the user is explicitly asking to create/add a task.",
    );
    expect(prompt).toContain(
      'If required inputs for a mutation are missing and the user is not clearly asking for enrichment via sampling, return operation.type = "none"',
    );
  });
});
