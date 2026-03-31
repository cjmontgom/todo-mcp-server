import { describe, it, expect } from "vitest";
import { applyEnrichment, type EnrichableTask } from "./enrichment.js";

describe("Task enrichment logic", () => {
  it("applies all fields from a valid LLM response", () => {
    const task: EnrichableTask = {
      title: "fix bug",
      description: "something broken",
      priority: "medium",
    };

    const llmResponse = JSON.stringify({
      title: "Fix authentication timeout bug in login flow",
      description:
        "Investigate and resolve the timeout error occurring during user authentication",
      priority: "high",
      dueDate: "2026-04-15",
    });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(true);
    expect(result.changedFields).toEqual(["title", "description", "priority", "dueDate"]);
    expect(task.title).toBe("Fix authentication timeout bug in login flow");
    expect(task.description).toBe(
      "Investigate and resolve the timeout error occurring during user authentication"
    );
    expect(task.priority).toBe("high");
    expect(task.dueDate).toBe("2026-04-15");
  });

  it("applies only provided fields, leaving others unchanged", () => {
    const task: EnrichableTask = {
      title: "fix bug",
      description: "original description",
      priority: "low",
      dueDate: "2026-03-30",
    };

    const llmResponse = JSON.stringify({
      title: "Fix critical rendering bug",
    });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(true);
    expect(result.changedFields).toEqual(["title"]);
    expect(task.title).toBe("Fix critical rendering bug");
    expect(task.description).toBe("original description");
    expect(task.priority).toBe("low");
    expect(task.dueDate).toBe("2026-03-30");
  });

  it("rejects invalid priority values", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const llmResponse = JSON.stringify({
      priority: "critical",
    });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(false);
    expect(task.priority).toBe("medium");
  });

  it("returns enriched=false for non-JSON response", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const result = applyEnrichment(task, "Sorry, I can't help with that.");

    expect(result.enriched).toBe(false);
    expect(task.title).toBe("test");
  });

  it("returns enriched=false for empty response", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const result = applyEnrichment(task, "");

    expect(result.enriched).toBe(false);
    expect(task.title).toBe("test");
  });

  it("does not overwrite fields with empty string values", () => {
    const task: EnrichableTask = {
      title: "test task",
      description: "important task",
      priority: "high",
    };

    const llmResponse = JSON.stringify({
      title: "",
      description: "",
    });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(false);
    expect(result.changedFields).toEqual([]);
    expect(task.title).toBe("test task");
    expect(task.description).toBe("important task");
  });

  it("returns enriched=false for JSON arrays", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const result = applyEnrichment(task, '[{"title": "bad"}]');

    expect(result.enriched).toBe(false);
  });

  it("returns enriched=false for JSON primitives", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const result = applyEnrichment(task, '"just a string"');

    expect(result.enriched).toBe(false);
  });

  it("returns enriched=false for empty JSON object (no fields changed)", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const result = applyEnrichment(task, "{}");

    expect(result.enriched).toBe(false);
    expect(result.changedFields).toEqual([]);
  });

  it("rejects non-string title values", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const llmResponse = JSON.stringify({ title: 42 });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(false);
    expect(task.title).toBe("test");
  });

  it("rejects invalid dueDate format", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const llmResponse = JSON.stringify({ dueDate: "next Tuesday" });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(false);
    expect(task.dueDate).toBeUndefined();
  });

  it("accepts valid ISO 8601 dueDate", () => {
    const task: EnrichableTask = {
      title: "test",
      description: "test",
      priority: "medium",
    };

    const llmResponse = JSON.stringify({ dueDate: "2026-04-15" });

    const result = applyEnrichment(task, llmResponse);

    expect(result.enriched).toBe(true);
    expect(result.changedFields).toEqual(["dueDate"]);
    expect(task.dueDate).toBe("2026-04-15");
  });
});
