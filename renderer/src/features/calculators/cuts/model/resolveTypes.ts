import { parseOrdersFromGrid } from "../core/type/parseOrdersFromGrid";
import type { GridView } from "../core/gridTypes";

export function resolveOrdersFromGrid(grid: GridView) {
  return parseOrdersFromGrid(grid);
}
