export interface GridRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  due: string;
  status: string;
}

const HEADER_MAP: Record<string, keyof GridRow> = {
  id: 'id',
  title: 'title',
  description: 'description',
  desc: 'description',
  priority: 'priority',
  due: 'due',
  duedate: 'due',
  status: 'status',
};

export function parseMarkdownTable(text: string): GridRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] =>
    line.slice(1, -1).split('|').map(c => c.trim());

  const headers = parseRow(lines[0]).map(h => h.toLowerCase());
  const dataLines = lines.slice(2); // lines[0]=header, lines[1]=separator row

  return dataLines.map(line => {
    const cells = parseRow(line);
    const row: Partial<GridRow> = {};
    headers.forEach((h, i) => {
      const field = HEADER_MAP[h];
      if (field) row[field] = cells[i] ?? '';
    });
    return { id: '', title: '', description: '', priority: '', due: '', status: '', ...row };
  });
}

export function parseJsonTaskArray(text: string): GridRow[] {
  try {
    const tasks = JSON.parse(text) as Array<{
      id: string;
      title: string;
      description?: string;
      priority: string;
      status: string;
      dueDate?: string | null;
    }>;
    return tasks.map(t => ({
      id: t.id ?? '',
      title: t.title ?? '',
      description: t.description ?? '',
      priority: t.priority ?? '',
      due: t.dueDate ?? '',
      status: t.status ?? '',
    }));
  } catch {
    return [];
  }
}
