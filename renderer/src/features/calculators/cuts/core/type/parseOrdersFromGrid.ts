// renderer/src/features/calculators/cuts/core/type/parseOrdersFromGrid.ts
// 1:1 порт из js/grid.js (часть getOrdersFromGrid + typ picking)

import { inferTypeKey, pickTypeCandidateFromRow } from "./inferTypeKey";

import type { GridColumn, GridView } from "../gridTypes";


export type ParsedOrder = {
  L: number;
  B: number;
  count: number;
  typKey?: string;
  typ?: string;
};

export type ParsedOrdersResult = {
  orders: ParsedOrder[];
  meta: {
    usedTypeContext: number;
    detectedTypColIndex: number;
    detectedTypKey?: string;
  };
};

// --- Typ krat: KOZ/KOP/SERR + wzór 34x38/30x3 ---
const GRATING_POS_RE = /\b(koz|kop|serr|serrated|serated|krata|kraty|wema)\b/i;
const STEP_NEG_RE = /\b(soz|sop|stopn|stopnie|stopien|stopień|schod|schody)\b/i;
const MESH_FLAT_RE = /\d+\s*[x×]\s*\d+(?:\s*\/\s*\d+\s*[x×]\s*\d+)?/i;

function canonHeader(s: unknown) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    // польские буквы (ł не нормализуется через NFD)
    .replace(/[ł]/g, "l")
    .replace(/[ó]/g, "o")
    .replace(/[ą]/g, "a")
    .replace(/[ć]/g, "c")
    .replace(/[ę]/g, "e")
    .replace(/[ś]/g, "s")
    .replace(/[żź]/g, "z")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "");
}

function isTypHeaderLike(title: unknown) {
  const n = canonHeader(title);
  if (!n) return false;
  return (
    n === "typ" ||
    n.includes("rodzaj") ||
    n.includes("asort") ||
    n.includes("opis") ||
    n.includes("nazwa") ||
    n.includes("produkt") ||
    n.includes("krata") ||
    n.includes("koz") ||
    n.includes("kop") ||
    n.includes("serr")
  );
}

function detectTypColFromColumns(columns: GridColumn[]) {
  for (let j = 0; j < columns.length; j++) {
    if (isTypHeaderLike(columns[j]?.title)) return j;
  }
  return -1;
}

// выбираем ячейку "Typ" для grupowania krat
function pickGratingTypCell(cells: unknown[], typCol: number) {
  const safe = (v: unknown) => String(v ?? "").trim();

  // 1) если есть колонка Typ/Opis/Nazwa — берём оттуда (если не похоже на "ступени")
  if (typCol >= 0 && typCol < cells.length) {
    const t = safe(cells[typCol]);
    if (t) {
      const low = t.toLowerCase();
      if (!STEP_NEG_RE.test(low)) return t;
    }
  }

  // 2) иначе: сначала "KOZ/KOP/SERR"+"wzór"
  for (const c of cells) {
    const s = safe(c);
    if (!s) continue;
    if (STEP_NEG_RE.test(s)) continue;
    if (GRATING_POS_RE.test(s) && MESH_FLAT_RE.test(s)) return s;
  }

  // 3) потом просто wzór
  for (const c of cells) {
    const s = safe(c);
    if (!s) continue;
    if (STEP_NEG_RE.test(s)) continue;
    if (MESH_FLAT_RE.test(s)) return s;
  }

  // 4) потом любое с KOZ/KOP/SERR
  for (const c of cells) {
    const s = safe(c);
    if (!s) continue;
    if (STEP_NEG_RE.test(s)) continue;
    if (GRATING_POS_RE.test(s)) return s;
  }

  return "";
}

function toNum(v: unknown) {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseOrdersFromGrid(grid: GridView): ParsedOrdersResult {
  const cols = Array.isArray(grid?.columns) ? grid.columns : [];
  const data = Array.isArray(grid?.rows) ? grid.rows : [];

  if (!cols.length || !data.length) {
    return { orders: [], meta: { usedTypeContext: 0, detectedTypColIndex: -1 } };
  }

  // роли колонок по заголовкам (как в grid.js)
  const roleByKey = new Map<string, "L" | "B" | "CNT" | "TYP">();
cols.forEach((c) => {
  const n = canonHeader(c.title);
  if (!n) return;

  // L
  if (
    n === "l" ||
    n.includes("dlugosc") ||
    n.includes("length") ||
    n.includes("длина")
  ) roleByKey.set(c.key, "L");

  // B
  if (
    n === "b" ||
    n.includes("szerokosc") ||
    n.includes("width") ||
    n.includes("ширина")
  ) roleByKey.set(c.key, "B");

  // COUNT
  if (
    n === "szt" ||
    n.includes("ilosc") ||
    n === "qty" ||
    n === "count" ||
    n === "pcs" ||
    n.includes("колво") ||
    n.includes("кол-во") ||
    n.includes("количество") ||
    n === "k" ||
    n === "q"
  ) roleByKey.set(c.key, "CNT");

  // TYP / OPIS / NAZWA (для группировки/контекста)
  if (
    n === "typ" || n === "type" ||
    n.includes("rodzaj") || n.includes("asort") || n.includes("opis") || n.includes("nazwa") ||
    n.includes("koz") || n.includes("kop") || n.includes("serr") || n.includes("krata") ||
    n.includes("plaskownik") || n.includes("plask") ||
    n.includes("oczko") || n.includes("oczek") || n.includes("mesh") ||
    n.includes("soz") || n.includes("sop") || n.includes("stopn") || n.includes("stopnie")
  ) {
    roleByKey.set(c.key, "TYP");
  }
});


  const keyL = [...roleByKey.entries()].find(([, r]) => r === "L")?.[0];
  const keyB = [...roleByKey.entries()].find(([, r]) => r === "B")?.[0];
  const keyCnt = [...roleByKey.entries()].find(([, r]) => r === "CNT")?.[0];
  const keyTyp = [...roleByKey.entries()].find(([, r]) => r === "TYP")?.[0];

  if (!keyL || !keyB || !keyCnt) {
    return { orders: [], meta: { usedTypeContext: 0, detectedTypColIndex: -1, detectedTypKey: keyTyp } };
  }

  const typColIdx = detectTypColFromColumns(cols);

  const orders: ParsedOrder[] = [];
  let currentTypCtx = "";
  let usedTypeContext = 0;

  for (const row of data) {
    const L = Math.round(toNum(row[keyL]));
    const B = Math.round(toNum(row[keyB]));
    const count = Math.max(0, Math.floor(toNum(row[keyCnt])));

    let rawTyp = "";

    // 1) явная колонка типа
    if (keyTyp) rawTyp = String(row[keyTyp] ?? "").trim();

    // 2) если нет — тип “krat” по всем ячейкам
    if (!rawTyp) {
      const cells = cols.map((c) => row[c.key]);
      rawTyp = pickGratingTypCell(cells, typColIdx);
    }

    // 3) общий fallback: NxM или слова
    if (!rawTyp) {
      const ignore = [keyL, keyB, keyCnt, keyTyp].filter(Boolean) as string[];
      rawTyp = String(pickTypeCandidateFromRow(row, ignore) ?? "").trim();
    }

    // stopnie/soz/... не считаем типом
    if (rawTyp && STEP_NEG_RE.test(String(rawTyp))) rawTyp = "";

    const typCanon = rawTyp ? inferTypeKey(rawTyp) : "";

    const hasDims = L > 0 && B > 0 && count > 0;

    // строка-заголовок типа
    if (!hasDims) {
      if (typCanon) currentTypCtx = typCanon;
      continue;
    }

    const o: ParsedOrder = { L, B, count };
    const finalTyp = typCanon || currentTypCtx || "";
    if (finalTyp) {
      o.typKey = finalTyp;
      o.typ = finalTyp;
      if (!typCanon && currentTypCtx) usedTypeContext++;
    }

    orders.push(o);
  }

  return {
    orders,
    meta: {
      usedTypeContext,
      detectedTypColIndex: typColIdx,
      detectedTypKey: keyTyp,
    },
  };
}
