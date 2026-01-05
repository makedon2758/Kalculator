import type { GridView } from "../../core/gridTypes";

export function makeEmptyRow(grid: GridView) {
  const r: Record<string, unknown> = {};
  grid.columns.forEach((c) => (r[c.key] = ""));
  return r;
}

export function setCell(grid: GridView, rowIdx: number, colKey: string, value: unknown): GridView {
  const rows = grid.rows.map((r, i) => (i === rowIdx ? { ...r, [colKey]: value } : r));
  return { ...grid, rows };
}

export function addRow(grid: GridView): GridView {
  return { ...grid, rows: grid.rows.concat(makeEmptyRow(grid)) };
}

export function removeRow(grid: GridView, rowIdx: number): GridView {
  if (grid.rows.length <= 1) {
    return { ...grid, rows: [makeEmptyRow(grid)] };
  }
  return { ...grid, rows: grid.rows.filter((_, i) => i !== rowIdx) };
}

export function setColumnTitle(grid: GridView, colKey: string, title: string): GridView {
  const columns = grid.columns.map((c) => (c.key === colKey ? { ...c, title } : c));
  return { ...grid, columns };
}

/**
 * Excel-like paste: вставка табличных данных (\t / \n) начиная с указанной ячейки.
 * - колонки не добавляем
 * - строки при необходимости добавляем
 */
export function pasteBlock(
  grid: GridView,
  startRowIdx: number,
  startColIdx: number,
  block: string[][]
): GridView {
  if (!block.length) return grid;

  const cols = grid.columns;
  const maxCols = cols.length;
  if (startColIdx >= maxCols) return grid;

  const neededRows = startRowIdx + block.length;
  let rows = grid.rows.slice();
  while (rows.length < neededRows) rows.push(makeEmptyRow(grid));

  rows = rows.map((r, ri) => {
    if (ri < startRowIdx || ri >= startRowIdx + block.length) return r;
    const line = block[ri - startRowIdx] || [];
    let next = { ...r };
    for (let ci = 0; ci < line.length; ci++) {
      const colIndex = startColIdx + ci;
      if (colIndex >= maxCols) break;
      const key = cols[colIndex].key;
      next[key] = line[ci];
    }
    return next;
  });

  return { ...grid, rows };
}
