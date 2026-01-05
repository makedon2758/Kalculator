// js/export.js
// Экспорт XLSX. Принимает AoA: plan, leftovers.
// Поддерживает 2 режима buildExportData:
//  - GRID: если переданы { gridView } → экспорт эхо-таблицы (каждой строке — свои доноры/подсказки)
//  - LEGACY: иначе — агрегированный «Raport cięcia».

let __ensureXlsxPromise = null;

function __buildGroupedExport(groups, sheetWidth, opts = {}) {
  let plan = null;
  let leftovers = null;

  for (const g of groups) {
    const label = `Typ: ${g.typLabel || g.typKey || "—"}`;
    const exp = buildExportData(g.result, sheetWidth, opts);

    if (!plan) plan = exp.plan.slice(0, 1);
    if (!leftovers) leftovers = exp.leftovers.slice(0, 1);

    plan.push([label, ...Array(plan[0].length - 1).fill("")]);
    plan.push(...exp.plan.slice(1));

    leftovers.push([label, ...Array(leftovers[0].length - 1).fill("")]);
    leftovers.push(...exp.leftovers.slice(1));
  }

  return { plan: plan || [], leftovers: leftovers || [] };
}

// --- Загрузчик: сначала xlsx-js-style (есть стили), потом SheetJS ---
export async function ensureXLSX() {
  if (__ensureXlsxPromise) return __ensureXlsxPromise;

  const styledSources = [
    '/vendor/xlsx-js-style.min.js'
  ];
  const plainSources = [
    '/vendor/xlsx.full.min.js'
  ];

  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error('load fail ' + src));
    document.head.appendChild(s);
  });

  __ensureXlsxPromise = (async () => {
    if (window.XLSX && window.__xlsxStyleCapable === true) return window.XLSX;

    for (const src of styledSources) {
      try {
        await load(src);
        if (window.XLSX) {
          window.__xlsxStyleCapable = true;
          return window.XLSX;
        }
      } catch (_) { }
    }

    if (window.XLSX) {
      window.__xlsxStyleCapable = false;
      console.warn('[export] xlsx-js-style nie załadował się — plik będzie bez stylów.');
      return window.XLSX;
    }

    for (const src of plainSources) {
      try {
        await load(src);
        if (window.XLSX) {
          window.__xlsxStyleCapable = false;
          console.warn('[export] załadowano SheetJS bez stylów — formatowanie będzie wyłączone.');
          return window.XLSX;
        }
      } catch (_) { }
    }

    throw new Error('Nie można załadować SheetJS / xlsx-js-style.');
  })();

  return __ensureXlsxPromise;
}

// ------------------ HELPERS ------------------
// найти индекс колонки "штук" по заголовку
function __qtyIdxFromHeader(header = []) {
  const isQty = (s) => __normTitle(s || '') && [
    'szt', 'ilosc', 'ilość', 'qty', 'count', 'kol-vo', 'кол-во', 'количество', 'ilosc szt', 'ilość szt'
  ].includes(__normTitle(s));
  for (let i = 0; i < header.length; i++) {
    if (isQty(header[i])) return i;
  }
  return -1;
}

// Блокировать склейку k·W + baseB?
function shouldBlockMerge(baseB, k, anti = {}) {
  const limitB = Number(anti?.limitMergeB);
  const maxK = Number(anti?.maxMergeK);

  if (!Number.isFinite(limitB)) return false;      // нет порога — не блокируем
  if (!(baseB > limitB)) return false;     // B не превышает порог — ок

  if (!Number.isFinite(maxK)) return true;      // порог есть, maxK нет — блок всё
  return k > maxK;                                  // мягко: блок только если k превышает
}

const __normTitle = s => String(s || '')
  .trim().toLowerCase().replace(/\s+/g, ' ')
  .replace(/[ł]/g, 'l').replace(/[ó]/g, 'o').replace(/[ą]/g, 'a')
  .replace(/[ć]/g, 'c').replace(/[ę]/g, 'e').replace(/[ś]/g, 's')
  .replace(/[żź]/g, 'z');

function __aggLB(list) {
  const m = new Map();
  (list || []).forEach(o => {
    const L = +o.L, B = +o.B, c = +o.count || 1;
    if (!(L > 0 && B > 0)) return;
    m.set(`${L}x${B}`, (m.get(`${L}x${B}`) || 0) + c);
  });
  return [...m.entries()].map(([k, v]) => {
    const [L, B] = k.split('x').map(Number);
    return { L, B, count: v };
  }).sort((a, b) => (a.L - b.L) || (a.B - b.B));
}

/* ------------------ BUILD EXPORT DATA (GRID + LEGACY) ------------------ */

// GRID: эхо-таблица (каждой строке — её доноры/подсказки/forced)
function __buildGridPlan(result, sheetW, gridView, anti = {}) {
  const { sheetUsage = [], usedFromLeftovers = [], scrapNeeds = [], leftovers = [] } = result;
  const forcedMapAll = (anti?.forcedMap instanceof Map) ? anti.forcedMap : new Map();

  // количество форматок по L
  const sheetCountByL = new Map();
  sheetUsage.forEach(g => {
    const [L] = String(g.key).replace('×', 'x').split(' x ').map(t => +t);
    sheetCountByL.set(L, (sheetCountByL.get(L) || 0) + (+g.sheetCount || 0));
  });

  // роли колонок
  const roles = new Map();
  gridView.columns.forEach(c => {
    const n = __normTitle(c.title);
    if (['l', 'dlugosc', 'długość', 'length', 'длина'].includes(n)) roles.set(c.key, 'L');
    if (['b', 'szerokosc', 'szerokość', 'width', 'ширина'].includes(n)) roles.set(c.key, 'B');
    if (['ilosc', 'ilość', 'qty', 'szt', 'count', 'кол-во', 'количество', 'ilosc szt', 'ilość szt'].includes(n)) roles.set(c.key, 'CNT');
  });
  const keyL = [...roles.entries()].find(([, r]) => r === 'L')?.[0];
  const keyB = [...roles.entries()].find(([, r]) => r === 'B')?.[0];
  const keyC = [...roles.entries()].find(([, r]) => r === 'CNT')?.[0];

  // очереди usedFromLeftovers
  const queues = new Map();
  (usedFromLeftovers || []).forEach(u => {
    const key = `${u.L} x ${u.B}`;
    const donors = new Map();
    (u.parts || []).forEach(p => {
      if (p.L === u.L) return;
      const donorB = +p.B || 0; if (donorB <= 0) return;
      const pk = `${p.L}x${donorB}`;
      donors.set(pk, (donors.get(pk) || 0) + 1);
    });
    const repeat = Math.max(1, +u.count || 1);
    if (!queues.has(key)) queues.set(key, []);
    for (let i = 0; i < repeat; i++) queues.get(key).push({ donors, fallback: !!u.fallback });
  });

  // złом-пул
  const scrapPool = new Map();
  (scrapNeeds || []).forEach(s => {
    const k = `${s.L} x ${s.restB}`;
    scrapPool.set(k, (scrapPool.get(k) || 0) + (+s.count || 1));
  });

  function takeForRow(L, targetB, qty) {
    const needB = targetB <= sheetW ? targetB : (targetB % sheetW);
    const key = `${L} x ${needB}`;
    const list = queues.get(key) || [];
    const donorsAgg = new Map();
    let anyFallback = false, used = 0;

    while (used < qty && list.length) {
      const ev = list.shift();
      ev.donors.forEach((c, pk) => donorsAgg.set(pk, (donorsAgg.get(pk) || 0) + c));
      anyFallback = anyFallback || ev.fallback;
      used++;
    }
    queues.set(key, list);

    let scrapTaken = 0;
    if (used < qty && targetB > sheetW && needB > 0) {
      const have = scrapPool.get(key) || 0;
      const take = Math.min(qty - used, have);
      if (take > 0) { scrapPool.set(key, have - take); scrapTaken = take; used += take; }
    }
    return { donorsAgg, fallback: anyFallback, scrapTaken };
  }

  // AoA
  // AoA
  const header = [...gridView.columns.map(c => c.title), 'Formatki'];
  const qtyIdx = __qtyIdxFromHeader(header);

  // Сумма szt только по реальным деталям (есть L/B и szt > 0)
  const totalPieces = (gridView.rows || []).reduce((s, r) => {
    if (!keyL || !keyB || !keyC) return s;

    const L = Number(r?.[keyL]);
    const B = Number(r?.[keyB]);
    const q = Number(r?.[keyC]);

    if (!Number.isFinite(L) || !Number.isFinite(B) || !Number.isFinite(q)) return s;
    if (L <= 0 || B <= 0 || q <= 0) return s;

    return s + q;
  }, 0);

  const plan = [header];

  const seenL = new Set();
  const forcedLeft = new Map(forcedMapAll); // чтобы не дублировать «forced» по строкам

  // Сортировка: сначала реальные детали (есть L/B), потом «хвосты» как в оригинале
  const rowsSorted = (gridView.rows || []).slice().sort((a, b) => {
    if (!keyL || !keyB) return 0;

    const La = Number(a?.[keyL]);
    const Lb = Number(b?.[keyL]);
    const Ba = Number(a?.[keyB]);
    const Bb = Number(b?.[keyB]);

    const aValid = Number.isFinite(La) && La > 0 && Number.isFinite(Ba) && Ba > 0;
    const bValid = Number.isFinite(Lb) && Lb > 0 && Number.isFinite(Bb) && Bb > 0;

    // 1) сначала строки с нормальными L/B
    if (aValid !== bValid) return aValid ? -1 : 1;

    // 2) оба «хвостовые» (комментарии, суммарные szt) — оставляем порядок как в исходнике
    if (!aValid && !bValid) return 0;

    // 3) оба реальные — сортируем по L, затем по B
    if (La !== Lb) return La - Lb;
    return Ba - Bb;
  });


  rowsSorted.forEach(r => {
    const L = +r?.[keyL], B = +r?.[keyB], qty = Math.max(1, +r?.[keyC] || 1);

    const fmt = (Number.isFinite(L) && !seenL.has(L)) ? (sheetCountByL.get(L) ?? '') : '';
    if (Number.isFinite(L)) seenL.add(L);

    // основная строка
    plan.push([...gridView.columns.map(c => r?.[c.key] ?? ''), fmt]);

    if (!Number.isFinite(L) || !Number.isFinite(B)) return;

    let notes = [];

    // (1) анти-правило «не резать» по L-порогу
    if (Number.isFinite(anti?.minLNoCut) && L <= anti.minLNoCut) {
      notes.push(`nie ciąć — znaleźć w złomie ${L}×${B} (${qty} szt.)`);
    } else {
      // (2) принудительное „szukaj w złomie” из forcedMap
      const fKey = `${L}x${B}`;
      const haveForced = forcedLeft.get(fKey) || 0;
      const useForced = Math.min(haveForced, qty);
      if (useForced > 0) {
        notes.push(`znaleźć w złomie ${B} (${useForced} szt.)`);
        forcedLeft.set(fKey, haveForced - useForced);
      }

      // (3) остаток количества — нормальные доноры/злом
      const restQty = Math.max(0, qty - useForced);
      if (restQty > 0) {
        const { donorsAgg, fallback, scrapTaken } = takeForRow(L, B, restQty);

        const donorsRows = [];
        donorsAgg.forEach((cnt, pk) => {
          const [LdStr, Bstr] = pk.split('x');
          donorsRows.push({ Ld: +LdStr, B: +Bstr, cnt });
        });
        donorsRows.sort((a, b) => (a.Ld - b.Ld) || (a.B - b.B));

        if (donorsRows.length) {
          const txt = donorsRows.map(e => `${e.Ld}×${e.B} (${e.cnt} szt)`).join(' + ');
          notes.push(`zamknięto z resztek ${txt}${fallback ? ' (poza tolerancją)' : ''}`);
        } else if (scrapTaken > 0 && B > sheetW) {
          const rest = B % sheetW;
          notes.push(`znaleźć w złomie ${rest} (${scrapTaken} szt.)`);
        }
      }
    }

    if (notes.length) {
      const row = new Array(header.length).fill('');
      row[0] = notes.join(' / ');
      plan.push(row);
    }
  });

  // ↓ NEW: футер — итог по штукам под колонкой количества
  if (qtyIdx >= 0) {
    const foot = new Array(header.length).fill('');
    foot[qtyIdx] = totalPieces;
    plan.push(foot);
  }


  const leftoversAoA = [['L', 'B', 'szt']];
  __aggLB((leftovers || []).map(o => ({ L: o.L, B: o.B, count: 1 }))).forEach(r => {
    leftoversAoA.push([r.L, r.B, r.count]);
  });

  return { plan, leftovers: leftoversAoA };
}

// LEGACY: агрегированный «Raport cięcia» (с учётом limitMergeB / maxMergeK)
function __buildLegacyPlan(result, sheetW, anti = {}) {
  const { sheetUsage = [], leftovers = [], usedFromLeftovers = [], scrapNeeds = [] } = result;

  const supplementAll = {};     // "L x B" -> { totalCount, parts(Map "LxB"->szt), anyFallback, anyOtherL }
  const supplementOtherL = {};  // "L x B" -> { count, parts(Map "LxB"->szt), anyFallback }

  (usedFromLeftovers || []).forEach(u => {
    const key = `${u.L} x ${u.B}`;
    const A = (supplementAll[key] ||= { totalCount: 0, parts: new Map(), anyFallback: false, anyOtherL: false });
    const cnt = +u.count || 1; A.totalCount += cnt;
    let hasOtherL = false;
    (u.parts || []).forEach(p => {
      const pk = `${p.L}x${p.B}`; // фактический B
      A.parts.set(pk, (A.parts.get(pk) || 0) + 1);
      if (p.L !== u.L) hasOtherL = true;
    });
    if (hasOtherL) A.anyOtherL = true;
    if (u.fallback) A.anyFallback = true;

    if (hasOtherL) {
      const B = (supplementOtherL[key] ||= { count: 0, parts: new Map(), anyFallback: false });
      B.count += cnt;
      (u.parts || []).forEach(p => {
        if (p.L === u.L) return;
        const pk = `${p.L}x${p.B}`;
        B.parts.set(pk, (B.parts.get(pk) || 0) + 1);
      });
      if (u.fallback) B.anyFallback = true;
    }
  });

  const scrapAgg = {};
  (scrapNeeds || []).forEach(s => {
    const key = `${s.L} x ${s.restB}`;
    const E = (scrapAgg[key] ||= { count: 0, k: s.k || 1 });
    E.count += (+s.count || 1);
  });

  const W = sheetW;
  const groups = new Map();
  (sheetUsage || []).forEach(g => groups.set(g.key, { ...g }));
  Object.keys(supplementAll).forEach(k => {
    const [Lstr] = k.split(' x ');
    const key = `${+Lstr} x ${W}`;
    if (!groups.has(key)) groups.set(key, { key, sheetCount: 0, items: [] });
  });
  Object.keys(scrapAgg).forEach(k => {
    const [Lstr] = k.split(' x ');
    const key = `${+Lstr} x ${W}`;
    if (!groups.has(key)) groups.set(key, { key, sheetCount: 0, items: [] });
  });

  const sorted = [...groups.values()].sort((a, b) => +a.key.split(' x ')[0] - +b.key.split(' x ')[0]);

  const plan = [['L', 'B', 'szt', 'Formatki']];

  // утилиты
  const mapToRows = (partsMap) => {
    if (!partsMap) return [];
    const rows = []; partsMap.forEach((cnt, pk) => { const [L, B] = pk.split('x'); rows.push({ L: +L, B: +B, count: cnt }); });
    rows.sort((a, b) => (a.L - b.L) || (a.B - b.B)); return rows;
  };
  const compressChains = (rows, step) => {
    if (!rows.length || !(+step > 0)) return rows.slice();
    const byL = new Map();
    rows.forEach(r => {
      if (!byL.has(r.L)) byL.set(r.L, new Map());
      const m = byL.get(r.L);
      m.set(r.B, (m.get(r.B) || 0) + (r.count || 1));
    });
    const res = [];
    byL.forEach((m, L) => {
      const Bs = [...m.keys()].sort((a, b) => b - a);
      const get = b => m.get(b) || 0, dec = b => m.set(b, get(b) - 1);
      for (const B0 of Bs) {
        let c = get(B0);
        while (c > 0) {
          dec(B0); c--;
          let next = B0 - step;
          while (get(next) > 0) { dec(next); next -= step; }
          res.push({ L, B: B0, count: 1 });
        }
      }
    });
    const agg = new Map();
    res.forEach(r => { const k = `${r.L}x${r.B}`; agg.set(k, (agg.get(k) || 0) + r.count); });
    return [...agg.entries()].map(([k, c]) => {
      const [L, B] = k.split('x').map(Number); return { L, B, count: c };
    }).sort((a, b) => (a.L - b.L) || (a.B - b.B));
  };

  sorted.forEach(s => {
    const [Lstr, Wstr] = s.key.split(' x ').map(t => t.trim());
    const L = +Lstr, Wnum = +Wstr;

    const totalByB = {};
    (s.items || []).forEach(it => {
      const [, bStr] = it.name.split(' x ').map(t => t.trim());
      const B = +bStr; totalByB[B] = (totalByB[B] || 0) + it.count;
    });
    Object.keys(supplementAll).filter(k => k.startsWith(`${L} x `)).forEach(k => {
      const [, bStr] = k.split(' x ').map(t => t.trim());
      const B = +bStr; totalByB[B] = (totalByB[B] || 0) + (supplementAll[k].totalCount || 0);
    });

    const cutByB = {};
    (s.items || []).forEach(it => {
      const [, bStr] = it.name.split(' x ').map(t => t.trim());
      const B = +bStr; cutByB[B] = (cutByB[B] || 0) + it.count;
    });

    const wholeClosedNote = (B, needCnt) => {
      const e = supplementAll[`${L} x ${B}`];
      if (!e || (e.totalCount || 0) < needCnt) return null;
      const rows = compressChains(mapToRows(e.parts), B);
      const txt = rows.map(r => `${r.L}×${r.B} (${r.count} szt)`).join(' + ');
      return `zamknięto w całości z resztek ${txt}${e.anyFallback ? ' (poza tolerancją)' : ''}`;
    };
    const noteForTarget = (displayedB, baseB) => {
      const need = baseB ?? displayedB;
      const e = supplementOtherL[`${L} x ${need}`];
      if (!e || e.count <= 0) return null;
      const rows = [];
      e.parts.forEach((uses, pk) => {
        const [LdStr, Bstr] = pk.split('x');
        const Ld = +LdStr, B = +Bstr; if (Ld === L) return;
        rows.push(`${Ld}×${B} (${uses} szt)`);
      });
      if (!rows.length) return null;
      return `zamknięto z resztek ${rows.join(' + ')}${e.anyFallback ? ' (poza tolerancją)' : ''}`;
    };

    const remain = { ...totalByB };
    const merged = [], plain = [];

    // złom (k·W + restB)
    Object.keys(scrapAgg).filter(k => k.startsWith(`${L} x `)).forEach(k => {
      const restB = +k.split(' x ')[1];
      const need = scrapAgg[k].count;
      const kStr = scrapAgg[k].k || 1;
      const needW = kStr * need;
      const haveW = remain[Wnum] || 0;
      if (haveW >= needW && need > 0) {
        if (!shouldBlockMerge(restB, kStr, anti)) {
          merged.push({ B: kStr * Wnum + restB, baseB: restB, count: need, k: kStr, _fromScrap: true });
          remain[Wnum] -= needW;
        }
      }
    });

    // обычные склейки kGuess*W + b
    let nW = remain[Wnum] || 0;
    const addWidths = Object.keys(remain).map(Number).filter(b => b !== Wnum && remain[b] > 0);
    const sumAddCnt = addWidths.reduce((s, b) => s + (remain[b] || 0), 0);
    const kGuess = sumAddCnt > 0 ? Math.max(1, Math.floor(nW / sumAddCnt)) : 0;

    if (kGuess > 0) {
      for (const b of addWidths.sort((a, b) => a - b)) {
        if (remain[b] <= 0 || nW < kGuess) continue;
        const canPair = Math.min(remain[b], Math.floor(nW / kGuess));
        if (canPair <= 0) continue;

        if (!shouldBlockMerge(b, kGuess, anti)) {
          merged.push({ B: kGuess * Wnum + b, baseB: b, count: canPair, k: kGuess });
          remain[b] -= canPair;
          nW -= canPair * kGuess;
        }
      }
    }

    if (nW > 0) plain.push({ B: Wnum, count: nW });
    addWidths.forEach(b => { if (remain[b] > 0) plain.push({ B: b, count: remain[b] }); });

    // итог: сколько реально использовано W
    const wUsedTotal =
      merged.reduce((s, x) => s + (x.k || 0) * (x.count || 0), 0) +
      (plain.find(p => p.B === Wnum)?.count || 0);

    // рендер в AoA
    let firstRow = true;

    merged.sort((a, b) => a.B - b.B).forEach(x => {
      plan.push([L, x.B, x.count, firstRow ? wUsedTotal : '']);
      firstRow = false;
      if (x._fromScrap) {
        plan.push([`znaleźć w złomie ${x.baseB} (${x.count} szt.)`, '', '', '']);
      } else {
        const n = noteForTarget(x.B, x.baseB);
        if (n) plan.push([n, '', '', '']);
      }
    });

    plain.sort((a, b) => a.B - b.B).forEach(x => {
      plan.push([L, x.B, x.count, firstRow ? wUsedTotal : '']);
      firstRow = false;

      const cutCnt = cutByB[x.B] || 0;
      if (cutCnt === 0) {
        const w = wholeClosedNote(x.B, x.count);
        if (w) { plan.push([w, '', '', '']); return; }
      }
      const n = noteForTarget(x.B);
      if (n) plan.push([n, '', '', '']);
    });
  });

  const leftoversAoA = [['L', 'B', 'szt']];
  __aggLB((leftovers || []).map(o => ({ L: o.L, B: o.B, count: 1 }))).forEach(r => {
    leftoversAoA.push([r.L, r.B, r.count]);
  });

  return { plan, leftovers: leftoversAoA };
}

export function buildExportData(result, sheetW = 1000, { gridView, anti } = {}) {
  if (result && Array.isArray(result.byTyp)) {
    return __buildGroupedExport(result.byTyp, sheetW, { gridView, anti });
  }
  if (gridView) return __buildGridPlan(result, sheetW, gridView, anti);
  return __buildLegacyPlan(result, sheetW, anti);
}


/* ================= XLSX (стили, обводки, группы) ================= */
export async function exportXLSX(plan, leftovers, fileName = 'raport_rozkroj.xlsx') {
  const XLSX = await ensureXLSX();
  const wb = XLSX.utils.book_new();

  // ---------- RAPORT ----------
  const ws = XLSX.utils.aoa_to_sheet(plan);
  const COLS = plan[0]?.length || 4;

  // ширина колонок (компактно)
  ws['!cols'] = Array.from({ length: COLS }, (_, i) => {
    if (i === COLS - 1) return { wch: 11 }; // Formatki
    if (i === 0) return { wch: 10 }; // L
    if (i === 1) return { wch: 10 }; // B
    if (i === 2) return { wch: 7 }; // szt
    return { wch: 12 };
  });

  // объединения и высоты для строк-примечаний
  const merges = [];
  const noteRows = [];
  for (let r = 1; r < plan.length; r++) {
    const row = plan[r] || [];
    const isNote = typeof row[0] === 'string' && row.slice(1).every(v => v === '' || v == null);
    if (isNote) { merges.push({ s: { r, c: 0 }, e: { r, c: COLS - 1 } }); noteRows.push(r); }
  }
  if (merges.length) ws['!merges'] = merges;
  if (noteRows.length) {
    ws['!rows'] = ws['!rows'] || [];
    noteRows.forEach(r => ws['!rows'][r] = { hpt: 26 });
  }

  // помощники стилей
  const ensureCell = (addr) => { if (!ws[addr]) ws[addr] = { t: 's', v: '' }; return ws[addr]; };
  const apply = (addr, style) => { const cell = ensureCell(addr); cell.s = Object.assign({}, cell.s || {}, style); };
  const A1 = (r, c) => XLSX.utils.encode_cell({ r, c });

  // ---- Цвета/границы ----
  const DARK = 'FF111827';   // почти чёрный (обводка групп)
  const GRIDc = 'FF000000';   // сетка — чёрная
  const F_HEAD = 'FFEAF5EA';  // шапка
  const F_NOTE = 'FFFEE2E2';  // заметки
  const F_DCOL = 'FFFFF3CD';  // Formatki
  const C_NOTE = 'FFDC2626';  // цвет текста заметок

  // пастельные заливки для групп L
  const GROUP_FILLS = [
    'FFF0F9FF', // голубой
    'FFFFF7ED', // ваниль
    'FFEFFBF1', // мятный
    'FFFFF1F2', // светло-розовый
    'FFFAF5FF', // сиреневый
    'FFEEF2FF'  // индиго-пастель
  ];
  const pickFill = (idx, prev) => {
    let c = GROUP_FILLS[idx % GROUP_FILLS.length];
    if (c === prev) c = GROUP_FILLS[(idx + 1) % GROUP_FILLS.length];
    return c;
  };

  // ==== НАСТРОЙКИ ТОЛЩИНЫ / ЦВЕТА ЛИНИЙ ====
  const GRID_STYLE = 'thin';     // обычная сетка
  const OUTLINE_STYLE = 'medium';   // рамка групп L
  const GRID_COLOR = GRIDc;
  const OUTLINE_COLOR = DARK;
  // =========================================

  const GRID_BORDER = {
    top: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    bottom: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    left: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
    right: { style: GRID_STYLE, color: { rgb: GRID_COLOR } },
  };
  const OUTLINE_BORDER = {
    top: { style: OUTLINE_STYLE, color: { rgb: OUTLINE_COLOR } },
    bottom: { style: OUTLINE_STYLE, color: { rgb: OUTLINE_COLOR } },
    left: { style: OUTLINE_STYLE, color: { rgb: OUTLINE_COLOR } },
    right: { style: OUTLINE_STYLE, color: { rgb: OUTLINE_COLOR } },
  };

  // шапка
  for (let c = 0; c < COLS; c++) {
    apply(A1(0, c), {
      fill: { patternType: 'solid', fgColor: { rgb: F_HEAD } },
      font: { bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: GRID_BORDER
    });
  }

  // основные строки
  for (let r = 1; r < plan.length; r++) {
    const row = plan[r] || [];
    const isNote = typeof row[0] === 'string' && row.slice(1).every(v => v === '' || v == null);

    for (let c = 0; c < COLS; c++) {
      if (isNote) {
        apply(A1(r, c), {
          fill: { patternType: 'solid', fgColor: { rgb: F_NOTE } },
          font: { bold: true, italic: true, color: { rgb: C_NOTE } },
          alignment: { wrapText: true, horizontal: 'left', vertical: 'center' },
          border: GRID_BORDER
        });
      } else {
        const align = (c === 2 /*szt*/ || c === COLS - 1) ? 'center' : 'left';
        apply(A1(r, c), {
          font: { bold: true },
          alignment: { horizontal: align, vertical: 'center' },
          border: GRID_BORDER
        });
      }
    }
  }

  // мягкая заливка колонки "Formatki" для НЕ заметок
  for (let r = 1; r < plan.length; r++) {
    const row = plan[r] || [];
    const isNote = typeof row[0] === 'string' && row.slice(1).every(v => v === '' || v == null);
    if (isNote) continue;
    const addr = A1(r, COLS - 1);
    const cell = ensureCell(addr);
    cell.s = Object.assign({}, cell.s || {}, {
      fill: { patternType: 'solid', fgColor: { rgb: F_DCOL } },
      border: Object.assign({}, cell.s?.border || {}, GRID_BORDER)
    });
  }

  // ---- ГРУППЫ ПО L: обводка включает заметки, заливка — только данные ----
  const normalize = s => String(s || '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ł]/g, 'l').replace(/[ó]/g, 'o').replace(/[ą]/g, 'a')
    .replace(/[ć]/g, 'c').replace(/[ę]/g, 'e').replace(/[ś]/g, 's')
    .replace(/[żź]/g, 'z');

  let lIdx = plan[0]?.findIndex(t =>
    ['l', 'dlugosc', 'długość', 'length', 'длина'].includes(normalize(t))
  );
  if (lIdx == null || lIdx < 0) lIdx = 0;

  const isNoteRow = (row) =>
    typeof row?.[0] === 'string' && row.slice(1).every(v => v === '' || v == null);

  const groups = [];
  let start = null;
  let currentL = null;

  for (let r = 1; r < plan.length; r++) {
    const row = plan[r] || [];
    if (isNoteRow(row)) continue; // заметки войдут в рамку автоматически

    const Lval = Number(row[lIdx]);
    if (!Number.isFinite(Lval)) {
      if (start != null) { groups.push({ start, end: r - 1 }); start = null; currentL = null; }
      continue;
    }
    if (start == null) { start = r; currentL = Lval; }
    else if (Lval !== currentL) { groups.push({ start, end: r - 1 }); start = r; currentL = Lval; }
  }
  if (start != null) groups.push({ start, end: plan.length - 1 });

  // Заливка групп (пропустить заметки), рамка — включает всё (в т.ч. заметки)
  let prevFill = null;
  groups.forEach((g, idx) => {
    const fillRgb = pickFill(idx, prevFill); prevFill = fillRgb;

    for (let r = g.start; r <= g.end; r++) {
      if (isNoteRow(plan[r])) continue; // не перекрашиваем розовые заметки
      for (let c = 0; c < COLS; c++) {
        const addr = A1(r, c);
        const cell = ensureCell(addr);
        cell.s = Object.assign({}, cell.s || {}, {
          fill: { patternType: 'solid', fgColor: { rgb: fillRgb } },
          border: Object.assign({}, cell.s?.border || {}, GRID_BORDER)
        });
      }
    }

    // рамка top/bottom
    for (let c = 0; c < COLS; c++) {
      const topCell = ensureCell(A1(g.start, c));
      const botCell = ensureCell(A1(g.end, c));
      topCell.s = Object.assign({}, topCell.s || {}, {
        border: Object.assign({}, topCell.s?.border || GRID_BORDER, { top: OUTLINE_BORDER.top })
      });
      botCell.s = Object.assign({}, botCell.s || {}, {
        border: Object.assign({}, botCell.s?.border || GRID_BORDER, { bottom: OUTLINE_BORDER.bottom })
      });
    }
    // рамка left/right
    for (let r = g.start; r <= g.end; r++) {
      const lCell = ensureCell(A1(r, 0));
      const rCell = ensureCell(A1(r, COLS - 1));
      lCell.s = Object.assign({}, lCell.s || {}, {
        border: Object.assign({}, lCell.s?.border || GRID_BORDER, { left: OUTLINE_BORDER.left })
      });
      rCell.s = Object.assign({}, rCell.s || {}, {
        border: Object.assign({}, rCell.s?.border || GRID_BORDER, { right: OUTLINE_BORDER.right })
      });
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Raport');

  // ---------- RESZTKI ----------
  const wsL = XLSX.utils.aoa_to_sheet(leftovers);
  wsL['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 7 }];

  const setL = (addr, style) => { if (!wsL[addr]) wsL[addr] = { t: 's', v: '' }; wsL[addr].s = Object.assign({}, wsL[addr].s || {}, style); };

  // шапка Resztki
  ['A1', 'B1', 'C1'].forEach(a => setL(a, {
    fill: { patternType: 'solid', fgColor: { rgb: F_HEAD } },
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: GRID_BORDER
  }));

  // строки Resztki
  for (let r = 2; r <= leftovers.length; r++) {
    ['A', 'B', 'C'].forEach((col, idx) => setL(`${col}${r}`, {
      font: { bold: true },
      alignment: { horizontal: idx === 2 ? 'center' : 'left', vertical: 'center' },
      border: GRID_BORDER
    }));
  }

  XLSX.utils.book_append_sheet(wb, wsL, 'Resztki');
  const safeName = String(fileName || 'raport_rozkroj.xlsx').trim() || 'raport_rozkroj.xlsx';
  const finalName = /\.xlsx$/i.test(safeName) ? safeName : (safeName + '.xlsx');
  XLSX.writeFile(wb, finalName, { compression: true });
}
// Eksport kalkulatora z mat: czytelny raport mat → maty_rozkroj.xlsx

export async function exportReport(_fmt, plan, leftovers, fileName) {
  return exportXLSX(plan, leftovers, fileName);
}


