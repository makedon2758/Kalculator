// legacy/raport1d/import/orders.js
import { NUM_CELL, trimCell } from './helpers.js';
import { isStepRowLikeStopnie } from './stopnieFilter.js';

/** Uproszczona normalizacja nagłówków: jak w stopnie.js */
const normHeaderSimple = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Szukamy, które kolumny to L, B i szt po nagłówkach */
export function detectLBQCols(headers) {
  let colL = -1;
  let colB = -1;
  let colQ = -1;

  for (let j = 0; j < headers.length; j++) {
    const n = normHeaderSimple(headers[j]);
    if (!n) continue;

    // L
    if (
      colL < 0 &&
      (n === "l" ||
        n.includes("dlugosc") ||
        n.includes("długość") ||
        n === "length" ||
        n === "длина")
    ) {
      colL = j;
      continue;
    }

    // B
    if (
      colB < 0 &&
      (n === "b" ||
        n.includes("szerokosc") ||
        n.includes("szerokość") ||
        n === "width" ||
        n === "ширина")
    ) {
      colB = j;
      continue;
    }

    // szt / ilość
    if (
      colQ < 0 &&
      (n === "szt" ||
        n.includes("ilosc") ||
        n.includes("ilość") ||
        n === "qty" ||
        n === "count" ||
        n === "pcs" ||
        n.includes("kol-vo") ||
        n.includes("кол-во") ||
        n.includes("количество"))
    ) {
      colQ = j;
      continue;
    }
  }

  return { colL, colB, colQ };
}

/* -------------------- główna funkcja: rows -> zamówienia L/B/szt -------------------- */

/**
 * rowsToOrders:
 *  - wykrywa kolumny L/B/szt po nagłówkach,
 *  - WYRZUCA wszystkie wiersze wyglądające na stopnie (SOZ/SOP/STOPNIE),
 *  - pomija śmieciowe/niepełne wiersze,
 *  - zwraca tablicę { L, B, count }.
 */
export function rowsToOrders(headers, rows) {
  if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows)) {
    return [];
  }

  const { colL, colB, colQ } = detectLBQCols(headers);
  if (colL < 0 || colB < 0 || colQ < 0) {
    console.warn(
      "[import] rowsToOrders: nie znaleziono kolumn L/B/szt w nagłówku:",
      headers
    );
    return [];
  }

  const keyL = headers[colL];
  const keyB = headers[colB];
  const keyQ = headers[colQ];

  const orders = [];
  let skippedSteps = 0;
  let skippedGarbage = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const cells = headers.map((h) => row[h]);

    // 1) wyrzucamy wszystko, co wygląda jak stopnie (SOZ/SOP/STOPNIE)
    if (isStepRowLikeStopnie(cells)) {
      skippedSteps++;
      continue;
    }

    // 2) czytamy L / B / szt
    const L = NUM_CELL(row[keyL]);
    const B = NUM_CELL(row[keyB]);
    const rawCount = row[keyQ];
    let count = NUM_CELL(rawCount);
    if (!(count > 0)) count = 1;

    // 3) Jeżeli wiersz ma jakieś treści, ale liczby są bez sensu -> śmieć
    if (!(L > 0 && B > 0 && count > 0)) {
      const hasAny = cells.some((c) => trimCell(c));
      if (hasAny) skippedGarbage++;
      continue;
    }

    // 4) Normalne zamówienie
    orders.push({ L, B, count });
  }

  console.info("[import] rowsToOrders summary", {
    totalRows: rows.length,
    orders: orders.length,
    skippedSteps,
    skippedGarbage,
  });

  return orders;
}
