// js/calc.js
// ESM: чистая логика расчёта, без DOM.
import { inferTypeKey } from "./type.js";
// --- нормализация B > W ------------------------------------------------------
export function normalizeOrders(orders, sheetWidth) {
  const normalized = [];
  for (const o of orders) {
    if (o.B <= sheetWidth) {
      normalized.push({ ...o, _origin: "native" });
      continue;
    }
    const fullStrips = Math.floor(o.B / sheetWidth);
    const rest = o.B % sheetWidth;
    if (fullStrips > 0) {
      normalized.push({
        L: o.L, B: sheetWidth, count: o.count * fullStrips,
        _origin: "split-full", _k: fullStrips
      });
    }
    if (rest > 0) {
      normalized.push({
        L: o.L, B: rest, count: o.count,
        _origin: "split-rest", _k: fullStrips
      });
    }
  }
  return normalized;
}

// --- мини-DP: лучший паттерн на лист W для заданного L -----------------------
export function bestPatternForL(demandMap, W, minLeftover) {
  const Bs = [...demandMap.keys()].filter(b => (demandMap.get(b) || 0) > 0).sort((a, b) => b - a);
  const dp = Array(W + 1).fill(null);
  dp[0] = { waste: W, take: new Map() };

  for (const B of Bs) {
    for (let s = W; s >= B; s--) {
      if (!dp[s - B]) continue;
      const prev = dp[s - B];
      const candWaste = W - s;
      const better = !dp[s] || candWaste < dp[s].waste;
      if (better) {
        const take = new Map(prev.take);
        take.set(B, (take.get(B) || 0) + 1);
        dp[s] = { waste: candWaste, take };
      }
    }
  }

  let best = null;
  for (let s = 0; s <= W; s++) {
    const st = dp[s]; if (!st) continue;
    const waste = W - s;
    if (waste !== 0 && waste < minLeftover) continue;
    if (!best || waste < best.waste) best = st;
  }
  return best; // { waste, take: Map(B->qty) } | null
}

// --- внутренний подбор комбинации остатков -----------------------------------
function pickBestCombo(need, orderL, candidates, toleranceL, mustContainSameL = false) {
  let best = null;

  const lexLess = (a, b) => {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const ai = a[i] ?? 0, bi = b[i] ?? 0;
      if (ai !== bi) return ai < bi;
    }
    return false;
  };

  function consider(picks, total, partialUsed) {
    if (total < need) return;
    const excess = total - need;
    const fb = picks.some(p => (p.lo.L - orderL) > toleranceL);
    const sameUsed = picks.reduce((s, p) => s + (p.lo.L === orderL ? p.usedB : 0), 0);
    const hasSame = sameUsed > 0;
    if (mustContainSameL && !hasSame) return;

    const sumTouchedB = picks.reduce((s, p) => s + (Number(p?.lo?.B) || 0), 0);
    // при равном excess/fallback/same/picks/partial — трогаем меньшие куски, большие сохраняем
    const score = [excess, fb ? 1 : 0, -sameUsed, picks.length, partialUsed, sumTouchedB];
    if (!best || lexLess(score, best.score)) {
      best = { picks: picks.map(p => ({ ...p })), score };
    }
  }

  // 0) точное попадание одной полосой
  const singleSame = candidates.find(lo => lo.L === orderL && lo.B === need);
  if (singleSame) return { picks: [{ lo: singleSame, usedB: need }], score: [0, 0, -need, 1, 0] };
  const singleAny = candidates.find(lo => lo.B === need);
  if (!mustContainSameL && singleAny) {
    const fb = (singleAny.L - orderL) > toleranceL;
    return { picks: [{ lo: singleAny, usedB: need }], score: [0, fb ? 1 : 0, 0, 1, 0] };
  }

  // 1) пары/тройки без частичного использования
  const cand = candidates.slice();
  for (let i = 0; i < cand.length; i++) {
    const a = cand[i];
    for (let j = i + 1; j < cand.length; j++) {
      const b = cand[j];
      if (a.B + b.B === need) {
        const hasSame = (a.L === orderL || b.L === orderL);
        if (!mustContainSameL || hasSame) consider(
          [{ lo: a, usedB: a.B }, { lo: b, usedB: b.B }], a.B + b.B, 0
        );
      }
      for (let k = j + 1; k < cand.length; k++) {
        const c = cand[k];
        if (a.B + b.B + c.B === need) {
          const hasSame = (a.L === orderL || b.L === orderL || c.L === orderL);
          if (!mustContainSameL || hasSame) consider(
            [{ lo: a, usedB: a.B }, { lo: b, usedB: b.B }, { lo: c, usedB: c.B }],
            a.B + b.B + c.B, 0
          );
        }
      }
    }
  }
  if (best) return best;

  // 2) разрешаем «надкус» одного остатка
  const CAND_LIMIT = 40;
  const list = candidates.slice().sort((a, b) =>
    ((a.L === orderL ? 0 : 1) - (b.L === orderL ? 0 : 1)) || (b.B - a.B)
  ).slice(0, CAND_LIMIT);

  (function dfs(i, total, picks, partialUsed) {
    if (total >= need) { consider(picks, total, partialUsed); return; }
    if (i >= list.length) return;

    // ✅ ВАЖНО: максимум 4 куска, как в правилах проекта
    if (picks.length >= 4) return;

    for (let j = i; j < list.length; j++) {
      const lo = list[j];

      // взять целиком
      picks.push({ lo, usedB: lo.B });
      dfs(j + 1, total + lo.B, picks, partialUsed);
      picks.pop();

      // один «надкус»
      const rest = need - total;
      if (partialUsed === 0 && rest > 0 && rest < lo.B) {
        picks.push({ lo, usedB: rest });
        dfs(j + 1, total + rest, picks, 1);
        picks.pop();
      }
    }
  })(0, 0, [], 0);


  return best;
}
// Подбор ЧАСТИЧНОГО закрытия: totalUsed <= need, стараемся закрыть максимально много.
// Разрешаем "надкусить" максимум 1 остаток (partial) — как и в pickBestCombo.
function pickBestPartial(need, orderL, candidates, toleranceL, mustContainSameL = false) {
  const list = (candidates || []).filter(Boolean).slice().sort((a, b) => b.B - a.B);

  // Даже если пусто — вернём [] (это значит "ничем не закрыли")
  if (list.length === 0) return [];

  let best = null;
  let bestScore = null;

  const lexLess = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a[i] < b[i];
    }
    return a.length < b.length;
  };

  const score = (picks, totalUsed, partialUsed) => {
    const missing = Math.max(0, need - totalUsed);

    const hasSameL = picks.some((p) => p.lo.L === orderL);
    if (mustContainSameL && !hasSameL) return null;

    const fallback = picks.some((p) => Math.abs(p.lo.L - orderL) > toleranceL);

    const sameCnt = picks.filter((p) => p.lo.L === orderL).length;
    const foreignCnt = picks.length - sameCnt;

    // Чем меньше missing — тем лучше.
    // Потом: без fallback лучше.
    // Потом: больше same-L лучше.
    // Потом: меньше foreign лучше.
    // Потом: меньше кусков лучше.
    // Потом: без partial лучше.
    return [missing, fallback ? 1 : 0, -sameCnt, foreignCnt, picks.length, partialUsed ? 1 : 0];
  };

  const consider = (picks, totalUsed, partialUsed) => {
    const sc = score(picks, totalUsed, partialUsed);
    if (!sc) return;
    if (!bestScore || lexLess(sc, bestScore)) {
      bestScore = sc;
      best = picks.slice();
    }
  };

  const dfs = (startIdx, picks, totalUsed, partialUsed) => {
    // фиксируем текущий вариант (в т.ч. неполный)
    if (picks.length > 0) consider(picks, totalUsed, partialUsed);

    if (picks.length >= 3) return;

    for (let i = startIdx; i < list.length; i++) {
      const lo = list[i];

      // 1) берём целиком, если помещается
      if (totalUsed + lo.B <= need) {
        picks.push({ lo, usedB: lo.B, partial: false });
        dfs(i + 1, picks, totalUsed + lo.B, partialUsed);
        picks.pop();
      }

      // 2) "надкус" (закрыть ровно остаток need-totalUsed), если partial ещё не использовали
      if (!partialUsed) {
        const rest = need - totalUsed;
        if (rest > 0 && rest < lo.B) {
          picks.push({ lo, usedB: rest, partial: true });
          // после надкуса totalUsed становится ровно need
          consider(picks, need, true);
          picks.pop();
        }
      }
    }
  };

  dfs(0, [], 0, false);

  // Если ничего не выбрали — это "0 закрыли"
  return best || [];
}

// === Анти-хелперы: считаем только ЧУЖИЕ доноры (L ≠ orderL) =================
// --- helpers: лимиты на доноров (anti.limitMergeB + anti.maxMergeK) ----------

// лимит активен, если включён anti и фактическая ширина > limitMergeB
function isLimitOn(anti, width) {
  const limit = Number(anti?.limitMergeB);
  return !!anti?.enabled && Number.isFinite(limit) && width > limit;
}

// читаем k (макс. ЧУЖИХ доноров). Пусто/нечисло => 0
function getMaxForeign(anti) {
  const k = Number(anti?.maxMergeK);
  return Number.isFinite(k) && k >= 0 ? Math.floor(k) : 0;
}

// считаем ЧУЖИХ доноров (по L)
function countForeignDonors(orderL, combo) {
  if (!combo || !Array.isArray(combo.picks)) return 0;
  let foreign = 0;
  for (const p of combo.picks) {
    const don = p?.lo;
    if (!don) continue;
    if (don.L !== orderL) foreign += 1;   // свой L — не считаем, чужой — считаем
  }
  return foreign;
}

/**
 * Ограничение доноров для Обычной детали (B <= W).
 * Правило: при B > limitB — свои L без ограничений, чужих L ≤ k.
 * Возвращает combo как есть либо null, если нарушен лимит.
 */
export function capLeftoverDonors(targetB, orderL, combo, anti) {
  if (!combo) return null;
  if (!isLimitOn(anti, targetB)) return combo;        // лимит не активен — пропускаем
  const maxForeign = getMaxForeign(anti);             // k
  const foreign = countForeignDonors(orderL, combo);  // только чужие
  return foreign <= maxForeign ? combo : null;
}

/**
 * Ограничение доноров для Огонька split-rest (B > W).
 * Используем исходную ширину детали origB = stripes*W + rest.
 * Правило: если origB > limitB — свои L без лимита, чужих L ≤ k.
 */
export function capOgonekDonors(origB, orderL, combo, anti) {
  if (!combo) return null;
  if (!isLimitOn(anti, origB)) return combo;
  const maxForeign = getMaxForeign(anti);
  const foreign = countForeignDonors(orderL, combo);
  return foreign <= maxForeign ? combo : null;
}






// --- основной расчёт ---------------------------------------------------------
/**
 * @param {Array<{L:number,B:number,count:number}>} orders
 * @param {Object} opts
 * @param {number} opts.sheetWidth
 * @param {number} opts.toleranceL
 * @param {boolean} opts.allowFallback
 * @param {number} opts.minLeftover
 * @param {number} opts.tailWantedB
 * @param {boolean} [opts.orderByRemainder=false]
 * @param {{enabled?:boolean,minLNoCut?:number|null,limitMergeB?:number|null,maxMergeK?:number|null}} [opts.anti]
 * @returns {{
 *   sheetUsage:Array<{key:string,sheetCount:number,items:Array<{name:string,count:number}>}>,
 *   leftovers:Array<{L:number,B:number,id:number}>,
 *   usedFromLeftovers:Array<{L:number,B:number,parts:Array<{L:number,B:number,usedB:number,id:number}>,fallback:boolean,count:number}>,
 *   scrapNeeds:Array<{L:number,restB:number,count:number,k:number}>,
 *   scrapProduced:Array<{L:number,B:number,count:number}>,
 *   wantedScrapB:number,
 *   forcedMap: Map<string, number>,
 *   error?:{type:"tooWide", L:number, B:number, sheetWidth:number}
 * }}
 */
export function calculateCuts(
  orders,
  {
    sheetWidth = 1000,
    toleranceL = 2,
    allowFallback = false,
    minLeftover = 0,
    tailWantedB = 0,
    orderByRemainder = false,
    anti = {}
  }
) {
  // --- Anti-waste препроцессинг (отсекаем "не резать" и запрещённые широкие склейки)
  const forcedMap = new Map(); // "LxB" -> szt
  const bumpForced = (L, B, cnt = 1) => {
    const k = `${L}x${B}`;
    forcedMap.set(k, (forcedMap.get(k) || 0) + (cnt || 1));
  };
  // --- anti: lastNoCutB = MAKSYMALNY NIEDOBÓR (missing, mm), który wolno dobrać ze złomu
  // żeby NIE ciąć ostatniej niepełnej formatki.
  const __lastMissingLimit = Number(anti?.lastNoCutB);
  const __lastMissingOn = !!anti?.enabled && Number.isFinite(__lastMissingLimit) && __lastMissingLimit > 0;


  const ordersForCalc = [];
  for (const o of orders) {
    const L = Number(o.L), B = Number(o.B), C = Math.max(1, Number(o.count) || 1);
    if (!(L > 0 && B > 0 && C > 0)) continue;

    if (anti?.enabled) {
      // правило 1: "не резать", если L ≤ minLNoCut
      if (Number.isFinite(anti.minLNoCut) && L <= anti.minLNoCut) {
        bumpForced(L, B, C);
        continue;
      }
    }

    ordersForCalc.push({ L, B, count: C });
  }

  // 1) нормализация ширины
  const norm = normalizeOrders(ordersForCalc, sheetWidth);

  // группируем по L
  const byL = new Map();
  norm.forEach(o => { if (!byL.has(o.L)) byL.set(o.L, []); byL.get(o.L).push({ ...o }); });

  // сортировка B внутри L
  Array.from(byL.values()).forEach(arr => arr.sort((a, b) => {
    if (!orderByRemainder) return b.B - a.B;
    const rA = sheetWidth % a.B;
    const rB = sheetWidth % b.B;
    if (rA !== rB) return rA - rB;
    return b.B - a.B;
  }));

  const Ls = Array.from(byL.keys()).sort((a, b) => b - a);

  // аккумуляторы
  let __leftoverId = 1;
  const leftovers = [];             // {L,B,id}
  const sheets = {};                // "L x W" -> {sheetCount, items:[{name,count}]}
  const usedFromLeftovers = [];     // {L,B,parts:[{L,B,usedB,id}],fallback,count}
  const scrapNeeds = [];            // [{L, restB, count, k}]
  const tailReqByL = new Map();     // L -> Map(restB -> count)
  const scrapProduced = [];         // {L,B,count}

  const pushScrap = (L, B, qty = 1) => {
    if (L > 0 && B > 0 && qty > 0) scrapProduced.push({ L, B, count: qty });
  };
  // удаляем пустые/мелкие остатки (и мелочь уводим в złom)
  const pruneLeftovers = () => {
    for (let i = leftovers.length - 1; i >= 0; i--) {
      const lo = leftovers[i];
      if (!lo || lo.B <= 0) {
        leftovers.splice(i, 1);
        continue;
      }
      if (lo.B < minLeftover) {
        // мелочь не держим как resztka
        pushScrap(lo.L, lo.B, 1);
        leftovers.splice(i, 1);
      }
    }
  };
  // --- próba: zamknąć N szt. szerokości needB z resztek + brak (missing) <= limit w złomie
  function tryClosePiecesWithScrap(orderL, needB, qtyPieces, { allowPureMissing = true } = {}) {
    if (!__lastMissingOn) return false;
    if (!(qtyPieces > 0) || !(needB > 0)) return false;

    // симуляция остатков, чтобы не нужно было rollback'ать splice/prune
    const sim = leftovers.map(lo => ({
      ref: lo,
      L: lo.L,
      B: lo.B,
      id: lo.id
    }));

    const plannedEvents = [];

    const sumUsed = (picks) => (picks || []).reduce((s, p) => s + (Number(p.usedB) || 0), 0);

    function planOne() {
      const elig = sim.filter(lo =>
        lo.B >= minLeftover &&
        lo.L >= orderL &&
        ((lo.L - orderL) <= toleranceL || allowFallback)
      );

      const sameL = elig.filter(lo => lo.L === orderL);
      const otherL = elig.filter(lo => lo.L !== orderL);

      const tryWith = (cands, mustContainSame) => {
        const picks = pickBestPartial(needB, orderL, cands, toleranceL, mustContainSame) || [];
        const usedSum = sumUsed(picks);
        const missing = Math.max(0, needB - usedSum);
        return { picks, usedSum, missing };
      };

      // 1) сначала — ТОЛЬКО свои
      let best = tryWith(sameL, false);

      // 2) если не уложились в лимит — разрешаем чужие, но если свои есть, то обязуемся взять хотя бы один свой
      if (best.missing > __lastMissingLimit) {
        const mustContainSame = sameL.length > 0;
        best = tryWith(sameL.concat(otherL), mustContainSame);
      }

      // 3) крайний случай: вообще без resztek (missing = needB), но только если needB <= limit
      if (best.missing > __lastMissingLimit) {
        if (allowPureMissing && needB <= __lastMissingLimit) best = { picks: [], usedSum: 0, missing: needB }; else return null;
      }

      // лимит доноров (anti.limitMergeB/maxMergeK) — применяем и сюда
      const capped = capLeftoverDonors(needB, orderL, { picks: best.picks }, anti);
      if (!capped) {
        // если лимит доноров запретил — допускаем вариант без resztek, но только если он проходит по лимиту missing
        if (allowPureMissing && needB <= __lastMissingLimit) best = { picks: [], usedSum: 0, missing: needB };
        else return null;
      }

      // применяем к SIM и собираем parts (важно: B = "сколько было ДО взятия", usedB = "сколько взяли")
      const parts = [];
      let fb = false;

      for (const p of (best.picks || [])) {
        const lo = p?.lo;
        const useB = Number(p?.usedB) || 0;
        if (!lo || useB <= 0) continue;

        const beforeB = lo.B;
        parts.push({ L: lo.L, B: beforeB, usedB: useB, id: lo.id });

        fb = fb || ((lo.L - orderL) > toleranceL);

        lo.B = beforeB - useB;

        // симуляция "минимального остатка": если стал меньше minLeftover — считаем, что уйдёт в złom (не используем дальше)
        if (lo.B > 0 && lo.B < minLeftover) lo.B = 0;
        if (lo.B < 0) lo.B = 0;
      }

      const usedSum = parts.reduce((s, x) => s + (Number(x.usedB) || 0), 0);
      const missing = Math.max(0, needB - usedSum);
      // ogonek-режим: запрещаем вариант "только missing без resztek"
      if (!allowPureMissing && parts.length === 0) return null;
      // финальная проверка лимита
      if (missing > __lastMissingLimit) return null;

      return { parts, fallback: fb, missing };
    }

    // планируем все qtyPieces
    for (let i = 0; i < qtyPieces; i++) {
      const ev = planOne();
      if (!ev) return false;
      plannedEvents.push(ev);
    }

    // ✅ commit: переносим B из SIM в реальные leftovers
    for (const s of sim) s.ref.B = s.B;

    // записываем события (для отчёта: donors + missing)
    for (const ev of plannedEvents) {
      // złom по длине (если взяли L > tolerance)
      for (const p of (ev.parts || [])) {
        const dL = Number(p.L) - orderL;
        if (dL > toleranceL) pushScrap(dL, Number(p.usedB) || 0, 1);
      }
      usedFromLeftovers.push({
        L: orderL,
        B: needB,
        parts: ev.parts || [],
        fallback: !!ev.fallback,
        count: 1
      });
    }

    // чистим мелочь из реальных leftovers
    pruneLeftovers();
    return true;
  }

  const keySheets = L => `${L} x ${sheetWidth}`;
  const addSheetUsage = (L, piecesWidth, count) => {
    const key = keySheets(L);
    if (!sheets[key]) sheets[key] = { sheetCount: 0, items: [] };
    sheets[key].items.push({ name: `${L} x ${piecesWidth}`, count });
  };
  const bumpSheetCount = (L, inc = 1) => {
    const key = keySheets(L);
    if (!sheets[key]) sheets[key] = { sheetCount: 0, items: [] };
    sheets[key].sheetCount += inc;
  };

  // хвосты (ogonek)
  const queueTail = (L, restB, qty = 1) => {
    if (!tailReqByL.has(L)) tailReqByL.set(L, new Map());
    const m = tailReqByL.get(L);
    m.set(restB, (m.get(restB) || 0) + qty);
  };
  const commitTailsForL = (L) => {
    const m = tailReqByL.get(L);
    if (!m) return;

    for (const [restB, cnt] of m.entries()) {
      if (!(restB > 0) || !(cnt > 0)) continue;

      const perSheetFull = Math.max(1, Math.floor(sheetWidth / restB));
      const fullSheets = Math.floor(cnt / perSheetFull);
      const partialPieces = cnt % perSheetFull;

      // 1) полные листы режем как раньше
      if (fullSheets > 0) {
        bumpSheetCount(L, fullSheets);
        addSheetUsage(L, restB, fullSheets * perSheetFull);

        const leftoverFull = sheetWidth - perSheetFull * restB;
        for (let i = 0; i < fullSheets; i++) {
          if (leftoverFull >= minLeftover) leftovers.push({ L, B: leftoverFull, id: __leftoverId++ });
          else if (leftoverFull > 0) pushScrap(L, leftoverFull, 1);
        }
      }
      

      // 2) последняя НЕПОЛНАЯ форматка:
      //    пробуем закрыть эти partialPieces через resztki + missing<=limit (złom).
      //    если не вышло — режем 1 лист как обычно.
      if (partialPieces > 0) {
        // Для ogonka разрешаем lastNoCutB ТОЛЬКО если реально взяли хоть одну resztkę (не чистый missing)
        const okNoCutTail = __lastMissingOn && tryClosePiecesWithScrap(L, restB, partialPieces, { allowPureMissing: false });
        if (!okNoCutTail) {
          bumpSheetCount(L, 1);
          addSheetUsage(L, restB, partialPieces);
          const leftoverPartial = sheetWidth - partialPieces * restB;
          if (leftoverPartial >= minLeftover) leftovers.push({ L, B: leftoverPartial, id: __leftoverId++ });
          else if (leftoverPartial > 0) pushScrap(L, leftoverPartial, 1);
        }
      }
    }
      tailReqByL.delete(L);
    };
    // основной цикл по L
    for (const L of Ls) {
      const rawGroup = byL.get(L);

      // агрегируем по ключу (_origin, B)
      const acc = new Map(); // key: `${o._origin}|${o.B}`
      for (const o of rawGroup) {
        const k = `${o._origin}|${o.B}`;
        if (!acc.has(k)) acc.set(k, { ...o, count: 0 });
        acc.get(k).count += o.count;
      }

      const group = [...acc.values()].sort((a, b) => {
        if (!orderByRemainder) return b.B - a.B;
        const rA = sheetWidth % a.B, rB = sheetWidth % b.B;
        return (rA !== rB) ? (rA - rB) : (b.B - a.B);
      });

      // Паттерны выключены по умолчанию
      const USE_PATTERNS = false;
      if (USE_PATTERNS) {
        const demand = new Map();
        group.forEach(o => {
          if (o._origin === "split-rest") return;
          demand.set(o.B, (demand.get(o.B) || 0) + o.count);
        });

        while (true) {
          const pat = bestPatternForL(demand, sheetWidth, minLeftover);
          if (!pat || !pat.take || pat.take.size === 0) break;

          let times = Infinity;
          pat.take.forEach((qty, B) => {
            times = Math.min(times, Math.floor((demand.get(B) || 0) / qty));
          });
          if (!(times > 0 && Number.isFinite(times))) break;

          bumpSheetCount(L, times);
          pat.take.forEach((qty, B) => {
            const need = qty * times;
            addSheetUsage(L, B, need);
            demand.set(B, (demand.get(B) || 0) - need);

            let left = need;
            for (const o of group) {
              if (o._origin === "split-rest") continue;
              if (o.B !== B || left <= 0) continue;
              const use = Math.min(o.count, left);
              o.count -= use;
              left -= use;
            }
          });

          if (pat.waste >= minLeftover) {
            for (let i = 0; i < times; i++) leftovers.push({ L, B: pat.waste, id: __leftoverId++ });
          } else if (pat.waste > 0) {
            for (let i = 0; i < times; i++) pushScrap(L, pat.waste, 1);
          }
        }

        for (let i = group.length - 1; i >= 0; i--) {
          if (group[i]._origin !== "split-rest" && group[i].count <= 0) group.splice(i, 1);
        }
      }

      for (const order of group) {
        let remaining = order.count;

        while (remaining > 0) {
          const need = order.B;

          // --- сплит-хвосты (ogonek)
          if (order._origin === "split-rest") {
            // ogonek: jeśli restB <= ogonLimit -> idzie do złomu (szukany ogonek)
            if (tailWantedB > 0 && need <= tailWantedB + 1e-9) {
              scrapNeeds.push({ L, restB: need, count: remaining, k: order._k || 1 });
              remaining = 0;
              continue;
            }
            {
              const elig2 = leftovers.filter(lo =>
                lo.B >= minLeftover && lo.L >= L && ((lo.L - L) <= toleranceL || allowFallback)
              );
              let best2 = pickBestCombo(need, L, elig2, toleranceL, false);

              // исходная ширина детали = k*W + rest (нужна для проверки лимита)
              const origB = (order._k || 0) * sheetWidth + need;
              best2 = capOgonekDonors(origB, L, best2, anti);

              if (best2) {
                const parts = [];
                best2.picks.forEach(p => {
                  const dL = p.lo.L - L;
                  if (dL > toleranceL) pushScrap(dL, p.usedB, 1);
                  parts.push({ L: p.lo.L, B: p.lo.B, usedB: p.usedB, id: p.lo.id });
                  p.lo.B -= p.usedB;
                });
                // чистка мелочи -> złom
                for (let i = leftovers.length - 1; i >= 0; i--) {
                  if (leftovers[i].B <= 0 || leftovers[i].B < minLeftover) {
                    if (leftovers[i].B > 0) pushScrap(leftovers[i].L, leftovers[i].B, 1);
                    leftovers.splice(i, 1);
                  }
                }
                const fb = best2.picks.some(p => (p.lo.L - L) > toleranceL);
                usedFromLeftovers.push({ L, B: order.B, parts, fallback: fb, count: 1 });
                remaining -= 1;
                continue;
              }
            }
            // nie mamy resztek na ogonek -> tniemy ogonki z formatki (paczka)
            queueTail(L, need, remaining);
            commitTailsForL(L);
            remaining = 0;
            continue;
          }

          // --- обычные детали
          const elig = leftovers.filter(lo =>
            lo.B >= minLeftover && lo.L >= L && ((lo.L - L) <= toleranceL || allowFallback)
          );
          const sameL = elig.filter(lo => lo.L === L);
          const otherL = elig.filter(lo => lo.L !== L);

          if (remaining > 1) {
            const R = sheetWidth - need;
            if (R >= minLeftover) {
              // Проверки «закроется ли из остатков» — с учётом лимита доноров
              const canCloseWithSame =
                !!capLeftoverDonors(need, L, pickBestCombo(need, L, sameL, toleranceL, false), anti);

              const canCloseNeedingOther = !canCloseWithSame &&
                !!capLeftoverDonors(need, L, pickBestCombo(need, L, sameL.concat(otherL), toleranceL, true), anti);
              if (!canCloseWithSame && canCloseNeedingOther) {
                const test1 = capLeftoverDonors(
                  need, L, pickBestCombo(need, L, sameL.concat([{ L, B: R }]), toleranceL, false), anti
                );
                const usesR1 = !!(test1 && test1.picks.some(p => (p.lo.L === L && p.lo.B === R)));
                if (usesR1) {
                  bumpSheetCount(L, 1);
                  addSheetUsage(L, need, 1);
                  remaining -= 1;
                  leftovers.push({ L, B: R, id: __leftoverId++ });
                  continue;
                }

                if (remaining > 2) {
                  const test2 = capLeftoverDonors(
                    need, L, pickBestCombo(need, L, sameL.concat([{ L, B: R }, { L, B: R }]), toleranceL, false), anti
                  );
                  const usesR2 = !!(test2 && test2.picks.some(p => (p.lo.L === L && p.lo.B === R)));
                  if (usesR2) {
                    bumpSheetCount(L, 2);
                    addSheetUsage(L, need, 2);
                    remaining -= 2;
                    leftovers.push({ L, B: R, id: __leftoverId++ }, { L, B: R, id: __leftoverId++ });
                    continue;
                  }
                }
              }
            }
          }

          if (sameL.length === 0 && otherL.length > 0 && remaining > 1) {
            const perSheet = Math.floor(sheetWidth / order.B);
            if (perSheet < 1) {
              // anti: nie tnij OSTATNIEJ niepełnej formatki:
              // próbuj zamknąć remaining szt. przez resztki + missing<=limit w złomie
              if (__lastMissingOn && remaining < perSheet) {
                const okNoCut = tryClosePiecesWithScrap(L, order.B, remaining);
                if (okNoCut) {
                  remaining = 0;
                  continue;
                }
              }
              bumpSheetCount(L, 1);
              const take = Math.min(remaining, perSheet);
            }
          }

          // подбор доноров с учётом лимита доноров
          let best = pickBestCombo(need, L, sameL, toleranceL, false);
          if (!best && sameL.length) best = pickBestCombo(need, L, sameL.concat(otherL), toleranceL, true);
          if (!best) best = pickBestCombo(need, L, elig, toleranceL, false);
          best = capLeftoverDonors(need, L, best, anti);
          if (best) {
            const parts = [];
            best.picks.forEach(p => {
              const dL = p.lo.L - L;
              if (dL > toleranceL) pushScrap(dL, p.usedB, 1);
              parts.push({ L: p.lo.L, B: p.lo.B, usedB: p.usedB, id: p.lo.id });
              p.lo.B -= p.usedB;
            });
            for (let i = leftovers.length - 1; i >= 0; i--) {
              if (leftovers[i].B <= 0 || leftovers[i].B < minLeftover) {
                if (leftovers[i].B > 0) pushScrap(leftovers[i].L, leftovers[i].B, 1);
                leftovers.splice(i, 1);
              }
            }
            const fb = best.picks.some(p => (p.lo.L - L) > toleranceL);
            usedFromLeftovers.push({ L, B: order.B, parts, fallback: fb, count: 1 });

            remaining -= 1;
            continue;
          }

          const perSheet = Math.floor(sheetWidth / order.B);
          if (perSheet < 1) {
            return {
              sheetUsage: [], leftovers: [], usedFromLeftovers: [],
              scrapNeeds: [], scrapProduced: [], wantedScrapB: tailWantedB,
              forcedMap,
              error: { type: "tooWide", L, B: order.B, sheetWidth }
            };
          }
          bumpSheetCount(L, 1);
          const take = Math.min(remaining, perSheet);
          addSheetUsage(L, order.B, take);
          remaining -= take;
          const restW = sheetWidth - take * order.B;
          if (restW >= minLeftover) leftovers.push({ L, B: restW, id: __leftoverId++ });
          else if (restW > 0) pushScrap(L, restW, 1);
        }
      }
      commitTailsForL(L);
    }

    for (const L of Array.from(tailReqByL.keys())) commitTailsForL(L);

    return {
      sheetUsage: Object.entries(sheets).map(([key, val]) => ({ key, sheetCount: val.sheetCount, items: val.items })),
      leftovers,
      usedFromLeftovers,
      scrapNeeds,
      scrapProduced,
      wantedScrapB: tailWantedB,
      forcedMap
    };
  }

