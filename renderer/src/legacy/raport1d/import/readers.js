// legacy/raport1d/import/readers.js
// Import CSV/XLS/XLSX -> grid { headers, rows } (no filtering, no mapping)

const XLSX_URL = '/vendor/xlsx.full.min.js';

export async function readFileAsGrid(file) {
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

