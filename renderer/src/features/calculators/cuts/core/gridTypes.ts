export type GridColumn = { key: string; title: string };
export type GridRow = Record<string, unknown>;
export type GridView = { columns: GridColumn[]; rows: GridRow[] };
