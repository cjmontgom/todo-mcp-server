import type { ColDef } from 'ag-grid-community';
import type { GridRow } from './parseMarkdownTable';

export const TASK_COLUMN_DEFS: ColDef<GridRow>[] = [
  { field: 'id',       headerName: 'ID',       width: 80 },
  { field: 'title',    headerName: 'Title',    flex: 1, minWidth: 150 },
  { field: 'priority', headerName: 'Priority', width: 120 },
  { field: 'due',      headerName: 'Due',      width: 130 },
  { field: 'status',   headerName: 'Status',   width: 120 },
];

export const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
};
