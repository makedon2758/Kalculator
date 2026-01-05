// legacy/raport1d/import/stopnieFilter.js
import { trimCell, normText, STEP_POS_RE, GRATING_NEG_RE } from './helpers.js';

export function isStepRowLikeStopnie(cells) {
  const joinedRaw = cells.map((c) => trimCell(c)).join(" ");
  if (!joinedRaw.trim()) return false;

  const joined = normText(joinedRaw);

  const hasPos = STEP_POS_RE.test(joined);
  const hasNeg = GRATING_NEG_RE.test(joined);

  if (hasPos) return true;

  // nagłówki/opisy
  if (joined.includes("stopnie prasowane") || joined.includes("sop - stopnie")) return true;

  // np. "SOZ 34x38/30x3" bez KOZ/KOP/krata
  if (!hasNeg && /(^|[^a-z0-9])soz[^a-z0-9]*\d+\s*x\s*\d+/.test(joined)) return true;

  return false;
}

export function stripStopnieRowsFromGrid(grid) {
  if (!grid || !Array.isArray(grid.headers) || !Array.isArray(grid.rows)) return grid;

  let skippedSteps = 0;
  const rows = grid.rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const cells = grid.headers.map((h) => row[h]);
    if (isStepRowLikeStopnie(cells)) {
      skippedSteps++;
      return false;
    }
    return true;
  });

  if (skippedSteps > 0) {
    console.info("[import] STOPNIE filtered:", { skippedSteps, before: grid.rows.length, after: rows.length });
  }
  return { ...grid, rows, meta: { ...(grid.meta || {}), skippedSteps } };
}
