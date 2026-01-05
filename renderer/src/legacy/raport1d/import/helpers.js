// legacy/raport1d/import/helpers.js

export const NUM_CELL = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.+-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// --- Normalizacja tekstu (PL/EN) ---
// Usuwa polskie znaki, sprowadza do ascii, normalizuje spacje.
export function normText(v) {
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

// W JS \b jest słabe dla diakrytyki, dlatego jedziemy na normText + granice "nie-alfanum".
export const STEP_POS_RE =
  /(^|[^a-z0-9])(soz|sop|stopn|stopnie|stopien|schod|schody)($|[^a-z0-9])/i;
export const GRATING_NEG_RE =
  /(^|[^a-z0-9])(koz|kop|krata|kraty)($|[^a-z0-9])/i;

export const trimCell = (v) => String(v ?? "").trim();
