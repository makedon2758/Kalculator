// js/import.js
// Import CSV/XLS/XLSX -> budujemy grid i zamówienia (L/B/szt) dla głównego kalkulatora KOZ.
// W TYM PLIKU od razu wyrzucamy wiersze ze stopniami (SOZ/SOP/STOPNIE).

const XLSX_URL = '/vendor/xlsx.full.min.js';

export function setupImport({ buttonId, inputId, onGrid, onOrders }) {
  const btn = document.getElementById(buttonId);
  const fileInput = document.getElementById(inputId);
  if (!btn || !fileInput) return;

  // Guard: React StrictMode mounts twice in dev -> avoid двойное навешивание listeners
  const __k = 'kcImportBound';
  if (btn.dataset?.[__k] === '1' || fileInput.dataset?.[__k] === '1') return;
  btn.dataset[__k] = '1';
  fileInput.dataset[__k] = '1';

  // Klik w przycisk -> otwieramy wybór pliku
  btn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1) Czytamy plik jako grid (nagłówki + surowe wiersze)
      const rawGrid = await readFileAsGrid(file); // { headers, rows }
      const grid = stripStopnieRowsFromGrid(rawGrid);

      if (typeof onGrid === 'function') onGrid(grid);


      // 2) Konwertujemy na zamówienia (L/B/szt) z odrzuceniem stopni
      const orders = rowsToOrders(grid.headers, grid.rows);
      if (typeof onOrders === "function") {
        onOrders(orders);
      }

      // 3) Jeśli tabelę udało się wczytać, ale nie znaleźliśmy L/B/szt
      if (
        (!orders || !orders.length) &&
        Array.isArray(grid.rows) &&
        grid.rows.length > 0
      ) {
        alert(
          "Plik został załadowany, ale nie udało się rozpoznać kolumn L/B/szt.\n" +
          "Tabela została zaimportowana, ale kalkulator nie może policzyć detali automatycznie."
        );
      }
    } catch (err) {
      console.error(err);
      alert("Nie udało się odczytać pliku:\n" + (err?.message || err));
    } finally {
      // żeby móc wybrać ten sam plik drugi raz
      e.target.value = "";
    }
  });
}

/* -------------------- czytanie pliku -------------------- */

async function readFileAsGrid(file) {
  const name = (file.name || "").toLowerCase();

  // CSV / TXT
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    return fromAOA(parseCSV(text));
  }

  // XLS / XLSX
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    await ensureXLSX();
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    return fromAOA(aoa);
  }

  throw new Error("Nieobsługiwany format pliku");
}

async function ensureXLSX() {
  if (typeof XLSX !== "undefined") return;
  await loadScript(XLSX_URL);
  if (typeof XLSX === "undefined") {
    throw new Error("Nie udało się załadować biblioteki XLSX");
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Load failed: " + src));
    document.head.appendChild(s);
  });
}

/* -------------------- CSV -> AOA -------------------- */

function parseCSV(text) {
  const raw = String(text)
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length);

  // Auto-wybór separatora: ; albo ,
  const delim =
    (text.match(/;/g)?.length || 0) >= (text.match(/,/g)?.length || 0)
      ? ";"
      : ",";

  return raw.map((line) => {
    const out = [];
    let cur = "";
    let q = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          q = !q;
        }
      } else if (ch === delim && !q) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }

    out.push(cur);
    return out.map((s) => s.trim());
  });
}

/* -------------------- AOA -> { headers, rows } -------------------- */

function fromAOA(aoa) {
  if (!aoa || !aoa.length) {
    return { headers: [], rows: [] };
  }

  const trim = (v) => String(v ?? "").trim();

  // Szukamy wiersza nagłówków — takiego, w którym występują coś w stylu L/B/szt
  const norm = (s) =>
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

  const isL = (s) =>
    ["l", "dlugosc", "długość", "length", "длина"].includes(norm(s));
  const isB = (s) =>
    ["b", "szerokosc", "szerokość", "width", "ширина"].includes(norm(s));
  const isQ = (s) =>
    [
      "szt",
      "ilosc",
      "ilość",
      "qty",
      "count",
      "pcs",
      "кол-во",
      "количество",
    ].includes(norm(s));

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
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = i;
    }
  }

  if (bestScore <= 0) {
    headerRowIdx = 0;
  }

  const rawHeaders = (aoa[headerRowIdx] || []).map((h) => trim(h));

  // 1) które kolumny faktycznie są używane
  const usedIdx = [];
  for (let j = 0; j < rawHeaders.length; j++) {
    const hasHeader = rawHeaders[j].length > 0;
    let hasData = false;
    for (let i = headerRowIdx + 1; i < aoa.length && !hasData; i++) {
      const v = aoa[i]?.[j];
      if (trim(v) !== "") hasData = true;
    }
    if (hasHeader || hasData) usedIdx.push(j);
  }

  // 2) nagłówki: niepuste i unikalne
  const seen = new Set();
  const headers = usedIdx.map((j, idx) => {
    let name = rawHeaders[j] || `Kolumna ${idx + 1}`;
    const base = name;
    let k = 2;
    while (seen.has(name)) {
      name = `${base} (${k++})`;
    }
    seen.add(name);
    return name;
  });

  // 3) wiersze -> obiekty; w pełni puste wyrzucamy
  const rows = aoa
    .slice(headerRowIdx + 1)
    .map((arr) => {
      const obj = {};
      let filled = false;
      usedIdx.forEach((j, idx) => {
        const v = arr?.[j] ?? "";
        const t = trim(v);
        if (t !== "") filled = true;
        obj[headers[idx]] = v ?? "";
      });
      return filled ? obj : null;
    })
    .filter(Boolean);

  return { headers, rows };
}

/* -------------------- wspólne helpery: liczby + nagłówki -------------------- */

/**
 * Bezpieczny parser liczby z komórki (spacje, przecinek jako separator dziesiętny itd.).
 */
const NUM_CELL = (v) => {
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
function normText(v) {
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
const STEP_POS_RE =
  /(^|[^a-z0-9])(soz|sop|stopn|stopnie|stopien|schod|schody)($|[^a-z0-9])/i;
const GRATING_NEG_RE =
  /(^|[^a-z0-9])(koz|kop|krata|kraty)($|[^a-z0-9])/i;

const trimCell = (v) => String(v ?? "").trim();

function isStepRowLikeStopnie(cells) {
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

function stripStopnieRowsFromGrid(grid) {
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


/** Uproszczona normalizacja nagłówków: jak w stopnie.js */
const normHeaderSimple = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Szukamy, które kolumny to L, B i szt po nagłówkach */
function detectLBQCols(headers) {
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
