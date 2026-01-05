import { ensureXlsx } from "@/shared/legacy/xlsx/ensureXlsx";
import type { GridView } from "../core/gridTypes";


type Grid = { headers: string[]; rows: Record<string, any>[]; meta?: any };
export type OrderRow = { L: number; B: number; count: number };

const trimCell = (v: any) => String(v ?? "").trim();

const NUM_CELL = (v: any) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.+-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

function normText(v: any) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[ł]/g, "l")
    .replace(/[ó]/g, "o")
    .replace(/[ą]/g, "a")
    .replace(/[ć]/g, "c")
    .replace(/[ę]/g, "e")
    .replace(/[ś]/g, "s")
    .replace(/[żź]/g, "z")
    .replace(/[ń]/g, "n")
    .replace(/[×·]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

const STEP_POS_RE =
  /(^|[^a-z0-9])(soz|sop|stopn|stopnie|stopien|schod|schody)($|[^a-z0-9])/i;
const GRATING_NEG_RE =
  /(^|[^a-z0-9])(koz|kop|krata|kraty)($|[^a-z0-9])/i;

function isStepRowLikeStopnie(cells: any[]) {
  const joinedRaw = cells.map((c) => trimCell(c)).join(" ");
  if (!joinedRaw.trim()) return false;

  const joined = normText(joinedRaw);

  const hasPos = STEP_POS_RE.test(joined);
  const hasNeg = GRATING_NEG_RE.test(joined);

  if (hasPos) return true;
  if (joined.includes("stopnie prasowane") || joined.includes("sop - stopnie")) return true;
  if (!hasNeg && /(^|[^a-z0-9])soz[^a-z0-9]*\d+\s*x\s*\d+/.test(joined)) return true;

  return false;
}

function stripStopnieRowsFromGrid(grid: Grid): Grid {
  if (!grid || !Array.isArray(grid.headers) || !Array.isArray(grid.rows)) return grid;

  let skippedSteps = 0;
  const rows = grid.rows.filter((row) => {
    const cells = grid.headers.map((h) => row[h]);
    if (isStepRowLikeStopnie(cells)) {
      skippedSteps++;
      return false;
    }
    return true;
  });

  return { ...grid, rows, meta: { ...(grid.meta || {}), skippedSteps } };
}

const normHeaderSimple = (s: any) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function detectLBQCols(headers: string[]) {
  let colL = -1, colB = -1, colQ = -1;

  for (let j = 0; j < headers.length; j++) {
    const n = normHeaderSimple(headers[j]);
    if (!n) continue;

    if (
      colL < 0 &&
      (n === "l" || n.includes("dlugosc") || n.includes("długość") || n === "length" || n === "длина")
    ) { colL = j; continue; }

    if (
      colB < 0 &&
      (n === "b" || n.includes("szerokosc") || n.includes("szerokość") || n === "width" || n === "ширина")
    ) { colB = j; continue; }

    if (
      colQ < 0 &&
      (n === "szt" || n.includes("ilosc") || n.includes("ilość") || n === "qty" || n === "count" || n === "pcs"
        || n.includes("kol-vo") || n.includes("кол-во") || n.includes("количество"))
    ) { colQ = j; continue; }
  }

  return { colL, colB, colQ };
}

function parseCSV(text: string) {
  const raw = String(text).replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length);

  const delim =
    (text.match(/;/g)?.length || 0) >= (text.match(/,/g)?.length || 0) ? ";" : ",";

  return raw.map((line) => {
    const out: string[] = [];
    let cur = "";
    let q = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === delim && !q) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  });
}

function fromAOA(aoa: any[][]): Grid {
  if (!aoa || !aoa.length) return { headers: [], rows: [] };
  const trim = (v: any) => String(v ?? "").trim();

  const norm = (s: any) =>
    trim(s)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[ł]/g, "l")
      .replace(/[ó]/g, "o")
      .replace(/[ą]/g, "a")
      .replace(/[ć]/g, "c")
      .replace(/[ę]/g, "e")
      .replace(/[ś]/g, "s")
      .replace(/[żź]/g, "z");

  const isL = (s: any) => ["l", "dlugosc", "długość", "length", "длина"].includes(norm(s));
  const isB = (s: any) => ["b", "szerokosc", "szerokość", "width", "ширина"].includes(norm(s));
  const isQ = (s: any) =>
    ["szt", "ilosc", "ilość", "qty", "count", "pcs", "кол-во", "количество"].includes(norm(s));

  let headerRowIdx = 0;
  let bestScore = -1;
  const maxScan = Math.min(30, aoa.length);

  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] || [];
    let nonEmpty = 0;
    let score = 0;

    for (let j = 0; j < row.length; j++) {
      const t = trim(row[j]);
      if (!t) continue;
      nonEmpty++;
      if (isL(t)) score += 5;
      if (isB(t)) score += 5;
      if (isQ(t)) score += 5;
    }

    if (!nonEmpty) continue;
    if (score > bestScore) { bestScore = score; headerRowIdx = i; }
  }

  if (bestScore <= 0) headerRowIdx = 0;

  const rawHeaders = (aoa[headerRowIdx] || []).map((h) => trim(h));

  const usedIdx: number[] = [];
  for (let j = 0; j < rawHeaders.length; j++) {
    const hasHeader = rawHeaders[j].length > 0;
    let hasData = false;
    for (let i = headerRowIdx + 1; i < aoa.length && !hasData; i++) {
      const v = aoa[i]?.[j];
      if (trim(v) !== "") hasData = true;
    }
    if (hasHeader || hasData) usedIdx.push(j);
  }

  const seen = new Set<string>();
  const headers = usedIdx.map((j, idx) => {
    let name = rawHeaders[j] || `Kolumna ${idx + 1}`;
    const base = name;
    let k = 2;
    while (seen.has(name)) name = `${base} (${k++})`;
    seen.add(name);
    return name;
  });

  const rows = aoa
    .slice(headerRowIdx + 1)
    .map((arr) => {
      const obj: Record<string, any> = {};
      let filled = false;
      usedIdx.forEach((j, idx) => {
        const v = arr?.[j] ?? "";
        const t = trim(v);
        if (t !== "") filled = true;
        obj[headers[idx]] = v ?? "";
      });
      return filled ? obj : null;
    })
    .filter(Boolean) as Record<string, any>[];

  return { headers, rows };
}

export function rowsToOrders(headers: string[], rows: Record<string, any>[]): OrderRow[] {
  if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows)) return [];

  const { colL, colB, colQ } = detectLBQCols(headers);
  if (colL < 0 || colB < 0 || colQ < 0) return [];

  const keyL = headers[colL];
  const keyB = headers[colB];
  const keyQ = headers[colQ];

  const orders: OrderRow[] = [];

  for (const row of rows) {
    const cells = headers.map((h) => row[h]);
    if (isStepRowLikeStopnie(cells)) continue;

    const L = NUM_CELL(row[keyL]);
    const B = NUM_CELL(row[keyB]);
    let count = NUM_CELL(row[keyQ]);
    if (!(count > 0)) count = 1;

    if (!(L > 0 && B > 0 && count > 0)) continue;
    orders.push({ L, B, count });
  }

  return orders;
}

export async function importFileToOrders(file: File): Promise<{ orders: OrderRow[]; meta: any }> {
  const name = (file.name || "").toLowerCase();

  let grid: Grid;

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    grid = fromAOA(parseCSV(text));
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await ensureXlsx();
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    grid = fromAOA(aoa);
  } else {
    throw new Error("Nieobsługiwany format pliku");
  }

  const stripped = stripStopnieRowsFromGrid(grid);
  const orders = rowsToOrders(stripped.headers, stripped.rows);

  return { orders, meta: stripped.meta || {} };
}

function gridToGridView(headers: string[], rows: Record<string, any>[]): GridView {
  const columns = headers.map((title, i) => ({
    key: `c${i}`,
    title: String(title ?? "").trim() || `col${i + 1}`,
  }));

  const outRows = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[`c${i}`] = r?.[h] ?? "";
    });
    return obj;
  });

  return { columns, rows: outRows };
}

export async function importFileToGridView(file: File): Promise<{ gridView: GridView; meta: any }> {
  const name = (file.name || "").toLowerCase();

  let grid: Grid;

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    grid = fromAOA(parseCSV(text));
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await ensureXlsx();
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    grid = fromAOA(aoa);
  } else {
    throw new Error("Nieobsługiwany format pliku");
  }

  const stripped = stripStopnieRowsFromGrid(grid);
  const gridView = gridToGridView(stripped.headers, stripped.rows);

  return { gridView, meta: stripped.meta || {} };
}

