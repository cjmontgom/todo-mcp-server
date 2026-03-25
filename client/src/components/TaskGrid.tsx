import { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import type { GridRow } from '../lib/parseMarkdownTable';
import { TASK_COLUMN_DEFS, DEFAULT_COL_DEF } from '../lib/taskColumns';

interface TaskGridProps {
  rows: GridRow[];
  note?: string;
  postAction?: string;
}

export function TaskGrid({ rows, note, postAction }: TaskGridProps) {
  const [filterText, setFilterText] = useState('');
  return (
    <div className="task-grid-wrapper">
      {note && <p className="grid-note">{note}</p>}
      {postAction && <p className="post-action">{postAction}</p>}
      <input
        type="text"
        className="filter-input"
        placeholder="Filter rows…"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        aria-label="Filter grid rows"
      />
      <div style={{ height: 400, width: '100%' }}>
        <AgGridReact<GridRow>
          theme={themeQuartz}
          rowData={rows}
          columnDefs={TASK_COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          quickFilterText={filterText}
        />
      </div>
    </div>
  );
}
