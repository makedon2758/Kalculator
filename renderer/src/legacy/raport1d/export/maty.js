import { ensureXLSX } from './cuts.js';

export async function exportMatyXLSX(mats, cfg = {}, srcInfo = '') {
  if (!Array.isArray(mats) || mats.length === 0) {
    throw new Error('Brak danych mat do eksportu');
  }

  const XLSX = await ensureXLSX();
  const wb = XLSX.utils.book_new();

  const matL = Math.max(0, Number(cfg.matL) || 0);
  const trim = Math.max(0, Number(cfg.trimStart) || 0);
  const tol = Number.isFinite(cfg.tol) ? Number(cfg.tol) : 0;
  const kerf = Math.max(0, Number(cfg.kerf) || 0);
  const target = Math.max(0, matL - trim);

  const totalPieces = mats.reduce((s, m) => {
    if (Array.isArray(m.items)) {
      return s + m.items.reduce((t, it) => t + (Number(it?.[1]) || 0), 0);
    }
    return s;
  }, 0);

  const rows = [];
  const COLS = 7;

  // -------------------- BLOK NAGŁÓWKA --------------------
  rows.push(['Kalkulator z mat — raport cięcia']); // r0
  rows.push([`Źródło danych: ${srcInfo || 'Raport cięcia (ostatnia sesja)'}`]); // r1
  rows.push([
    `Parametry maty: L = ${matL} mm, odjęte na początku = ${trim} mm, ` +
    `cel po odjęciu = ${target} mm, tolerancja ±${tol} mm, grubość piły = ${kerf} mm`
  ]); // r2
  rows.push([
    `Podsumowanie: liczba mat = ${mats.length}, łączna liczba kawałków = ${totalPieces} szt`
  ]); // r3
  rows.push([]); // r4 — przerwa

  const headerRow = rows.length;
  rows.push([
    'Mata',
    'Długość L (mm)',
    'Ilość szt.',
    'L × szt (mm)',
    'Zużyte mm na macie',
    'Δ względem celu (mm)',
    'Pozostało na macie (mm)'
  ]);

  // -------------------- DANE SZCZEGÓŁOWE --------------------
  const groupRanges = []; // zakresy wierszy dla każdej maty (do pogrubionej ramki)

  mats.forEach((m, idx) => {
    const items = Array.isArray(m.items) ? m.items : [];
    const used = Math.round(Number(m.usedMm) || 0);
    const delta = Math.round(Number(m.delta) || 0);
    const rest = Math.round(Math.max(0, Number(m.leftover) || 0));

    const groupStart = rows.length; // первый ряд этой маты в таблице

    if (!items.length) {
      // mata без деталей, только строка z zużyciem / resztką
      rows.push([
        `#${idx + 1}`,
        '',
        '',
        '',
        used || '',
        delta || '',
        rest || ''
      ]);
    } else {
      let sumPcs = 0;
      let sumMm = 0;

      items.forEach(([L, c], j) => {
        const Lnum = Number(L) || 0;
        const cnum = Number(c) || 0;
        const mm = Lnum * cnum;

        sumPcs += cnum;
        sumMm += mm;

        rows.push([
          j === 0 ? `#${idx + 1}` : '',
          Lnum,
          cnum,
          mm,
          j === 0 ? used : '',
          j === 0 ? delta : '',
          j === 0 ? rest : ''
        ]);
      });

      // podsumowanie jednej maty
      rows.push([
        '',
        'Razem na macie:',
        sumPcs,
        sumMm,
        '',
        '',
        ''
      ]);
    }

    const groupEnd = rows.length - 1; // ostatni niepusty wiersz tej maty
    groupRanges.push({ start: groupStart, end: groupEnd });

    rows.push([]); // odstęp между матами
  });

  // итог по всем матам
  rows.push([
    'RAZEM (wszystkie maty):',
    '',
    totalPieces,
    '',
    '',
    '',
    ''
  ]);
  rows.push([
    'Uwaga: wszystkie wartości są w milimetrach (mm).'
  ]);

  // -------------------- BUDOWA ARKUSZA --------------------
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // szerokości kolumn — czytelne
  ws['!cols'] = [
    { wch: 10 },  // Mata
    { wch: 14 },  // L
    { wch: 10 },  // szt
    { wch: 14 },  // L × szt
    { wch: 18 },  // Zużyte
    { wch: 22 },  // Δ
    { wch: 20 },  // Pozostało
  ];

  // Scalanie nagłówka (pierwsze 4 wiersze) na całą szerokość
  const merges = [];
  for (let r = 0; r <= 3; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: COLS - 1 } });
  }
  // ostatnia uwaga też na całą ширину
  merges.push({
    s: { r: rows.length - 1, c: 0 },
    e: { r: rows.length - 1, c: COLS - 1 }
  });
  ws['!merges'] = merges;

  // -------------------- STYLIZACJA --------------------
  const ensureCell = (addr) => {
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    return ws[addr];
  };
  const apply = (addr, style) => {
    const cell = ensureCell(addr);
    cell.s = Object.assign({}, cell.s || {}, style);
  };
  const A1 = (r, c) => XLSX.utils.encode_cell({ r, c });

  const F_TITLE = 'FFEEF2FF'; // lekki fiolet
  const F_HEAD = 'FFEAF5EA'; // szarawy nagłówek

  const GRID_STYLE = 'thin';
  const GRID_COLOR = 'FF9CA3AF';
  const GRID_BORDER = {
    top: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    bottom: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    left: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    right: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
  };

  // жирная рамка вокруг каждой маты
  const GROUP_STYLE = 'medium';
  const GROUP_COLOR = 'FF4B5563';
  const GROUP_BORDER = {
    top: { style: GROUP_STYLE, color: { rgb: GROUP_COLOR } },
    bottom: { style: GROUP_STYLE, color: { rgb: GROUP_COLOR } },
    left: { style: GROUP_STYLE, color: { rgb: GROUP_COLOR } },
    right: { style: GROUP_STYLE, color: { rgb: GROUP_COLOR } },
  };

  // карта: какой ряд к какой мате относится
  const groupMap = {};
  groupRanges.forEach(gr => {
    for (let r = gr.start; r <= gr.end; r++) {
      groupMap[r] = gr;
    }
  });

  // tytuł
  for (let c = 0; c < COLS; c++) {
    apply(A1(0, c), {
      fill: { patternType: 'solid', fgColor: { rgb: F_TITLE } },
      font: { bold: true, sz: 14 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
  }

  // linie 1–3: opis źródła/parametrów/podsumowania
  for (let r = 1; r <= 3; r++) {
    for (let c = 0; c < COLS; c++) {
      apply(A1(r, c), {
        font: { sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
    }
  }

  // nagłówek tabeli
  for (let c = 0; c < COLS; c++) {
    apply(A1(headerRow, c), {
      fill: { patternType: 'solid', fgColor: { rgb: F_HEAD } },
      font: { bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: GRID_BORDER
    });
  }

  // dane + жирные рамки вокруг każdej maty
  for (let r = headerRow + 1; r < rows.length - 1; r++) {
    const row = rows[r] || [];
    const isEmpty = row.every(v => v === '' || v == null);
    const gr = groupMap[r];
    const inGroup = !!gr;
    const isTop = inGroup && r === gr.start;
    const isBottom = inGroup && r === gr.end;

    for (let c = 0; c < COLS; c++) {
      const addr = A1(r, c);
      const baseAlign =
        c === 0 ? 'left' :
          c === 1 ? 'right' :
            c === 2 ? 'center' :
              'right';

      // базовая тонкая сетка
      let border = GRID_BORDER;

      if (inGroup) {
        // копия тонкой сетки, поверх ставим толстые края
        border = { ...GRID_BORDER };
        if (isTop) border.top = GROUP_BORDER.top;
        if (isBottom) border.bottom = GROUP_BORDER.bottom;
        if (c === 0) border.left = GROUP_BORDER.left;
        if (c === COLS - 1) border.right = GROUP_BORDER.right;
      }

      const style = {
        alignment: { horizontal: baseAlign, vertical: 'center' },
        border
      };

      // wiersze "Razem na macie" — пожирнее
      if (!isEmpty && String(row[1]).startsWith('Razem na macie')) {
        style.font = { bold: true };
      }

      apply(addr, style);
    }
  }

  // итоговая строка RAZEM
  const totalRow = rows.length - 2;
  for (let c = 0; c < COLS; c++) {
    const addr = A1(totalRow, c);
    apply(addr, {
      font: { bold: true },
      border: GRID_BORDER,
      alignment: { horizontal: c === 2 ? 'center' : 'left', vertical: 'center' }
    });
  }

  // uwaga na końcu — mniejsza czcionka, szary
  const noteRow = rows.length - 1;
  for (let c = 0; c < COLS; c++) {
    apply(A1(noteRow, c), {
      font: { sz: 9, color: { rgb: 'FF6B7280' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Maty');
  XLSX.writeFile(wb, 'maty_rozkroj.xlsx', { compression: true });
}



// Универсальный экспорт: только XLSX
