export interface SamplingComparisonFields {
  title?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
}

export interface SamplingEnrichmentDetails {
  original: SamplingComparisonFields;
  enriched: SamplingComparisonFields;
  changedFields: string[];
}

const CHANGE_RE = /([a-zA-Z][a-zA-Z0-9]*)\s*:\s*"([^"]*)"\s*→\s*"([^"]*)"/g;

function normalizeValue(value: string): string {
  return value === "(none)" ? "" : value;
}

export function parseSamplingEnrichment(
  text: string,
  original: SamplingComparisonFields
): SamplingEnrichmentDetails | null {
  if (!text.includes("enriched by AI")) {
    return null;
  }

  const enriched: SamplingComparisonFields = { ...original };
  const changedFields: string[] = [];

  for (const match of text.matchAll(CHANGE_RE)) {
    const field = match[1] as keyof SamplingComparisonFields;
    if (!(field in enriched)) {
      continue;
    }

    enriched[field] = normalizeValue(match[3]);
    changedFields.push(field);
  }

  if (changedFields.length === 0) {
    return null;
  }

  return {
    original: {
      title: original.title ?? "",
      description: original.description ?? "",
      priority: original.priority ?? "",
      dueDate: original.dueDate ?? "",
    },
    enriched: {
      title: enriched.title ?? "",
      description: enriched.description ?? "",
      priority: enriched.priority ?? "",
      dueDate: enriched.dueDate ?? "",
    },
    changedFields,
  };
}
