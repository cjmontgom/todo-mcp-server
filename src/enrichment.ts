export const VALID_PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof VALID_PRIORITIES)[number];

export interface EnrichableTask {
  title: string;
  description: string;
  priority: Priority;
  dueDate?: string;
}

export interface EnrichmentResult {
  enriched: boolean;
  changedFields: string[];
}

export function applyEnrichment(
  task: EnrichableTask,
  responseText: string,
): EnrichmentResult {
  try {
    const suggestions = JSON.parse(responseText);

    if (
      typeof suggestions !== "object" ||
      suggestions === null ||
      Array.isArray(suggestions)
    ) {
      return { enriched: false, changedFields: [] };
    }

    const changedFields: string[] = [];

    if (typeof suggestions.title === "string" && suggestions.title.trim()) {
      task.title = suggestions.title;
      changedFields.push("title");
    }
    if (typeof suggestions.description === "string" && suggestions.description.trim()) {
      task.description = suggestions.description;
      changedFields.push("description");
    }
    if (
      typeof suggestions.priority === "string" &&
      (VALID_PRIORITIES as readonly string[]).includes(suggestions.priority)
    ) {
      task.priority = suggestions.priority as Priority;
      changedFields.push("priority");
    }
    if (
      typeof suggestions.dueDate === "string" &&
      suggestions.dueDate.trim() &&
      !isNaN(Date.parse(suggestions.dueDate))
    ) {
      task.dueDate = suggestions.dueDate;
      changedFields.push("dueDate");
    }

    return { enriched: changedFields.length > 0, changedFields };
  } catch {
    return { enriched: false, changedFields: [] };
  }
}
