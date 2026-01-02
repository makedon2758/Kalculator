// js/type.js
// Универсальная нормализация "типа" (Typ) из разных форматов:
// - "34×38/40×3", "34x38/40x3"
// - "40x3" (płaskownik), "34x38" (oczko)
// - "płaskownik", "oczko" (даже без цифр)

function _clean(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\u00A0/g, " ")     // non-breaking space
    .replace(/[×]/g, "x")        // × -> x
    .replace(/\s+/g, " ");       // много пробелов -> один
}

function _compact(raw) {
  return _clean(raw).toLowerCase().replace(/\s+/g, "");
}

// Возвращает массив пар { a, b, text } из "34x38/40x3"
function _extractPairs(compact) {
  const out = [];
  const re = /(\d{1,4})x(\d{1,4})/g;
  let m;
  while ((m = re.exec(compact))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    out.push({ a, b, text: `${a}x${b}` });
  }
  return out;
}

// Основная функция: делает стабильный ключ типа (или "" если не распознали)
export function inferTypeKey(raw) {
  const s = _clean(raw);
  if (!s) return "";

  const lc = s.toLowerCase();
  const compact = _compact(s);

  const hasOczko =
    /oczko|oczek|oko|mesh|krat|krata|kratka|oczka/.test(lc);
  const hasPlask =
    /płaskownik|plaskownik|flat|bearing\s*bar|plask/.test(lc);

  // 1) Если есть явный формат с "/" — стараемся сохранить как "A/B"
  //    но нормализуем × и пробелы.
  if (compact.includes("/")) {
    // Сохраним только понятный вид, без лишних пробелов.
    // Пример: "34x38/40x3"
    const parts = compact.split("/").filter(Boolean);
    if (parts.length >= 2) {
      // В каждой части оставим первое совпадение NxM, если оно есть
      const p1 = _extractPairs(parts[0])[0]?.text;
      const p2 = _extractPairs(parts[1])[0]?.text;
      if (p1 && p2) return `${p1}/${p2}`;
    }
  }

  // 2) Ищем пары NxM
  const pairs = _extractPairs(compact);

  // Если пар нет вообще — но есть ключевые слова, вернём хотя бы их
  if (!pairs.length) {
    if (hasPlask) return "płaskownik";
    if (hasOczko) return "oczko";
    // иначе вернём очищенный текст как “тип” (лучше так, чем пусто)
    return _clean(raw);
  }

  // 3) Классификация:
  //    - oczko обычно "две большие цифры" (34x38)
  //    - płaskownik обычно "вторая маленькая" (40x3)
  //    (эвристика, но для твоих данных работает)
  const opening = pairs.find(p => p.a >= 10 && p.b >= 10); // 34x38
  const flatbar = pairs.find(p => p.a >= 10 && p.b > 0 && p.b < 10); // 40x3

  // Если нашли обе части — вернём комбинированный тип
  if (opening && flatbar) return `${opening.text}/${flatbar.text}`;

  // Если явно сказали płaskownik/oczko — подставим подходящую пару
  if (hasPlask) return `płaskownik ${flatbar?.text ?? pairs[0].text}`;
  if (hasOczko) return `oczko ${opening?.text ?? pairs[0].text}`;

  // Иначе просто вернём первую пару (например, "40x3" или "34x38")
  return pairs[0].text;
}

// Помогает выбрать “кандидат на тип” из строки грида (объект всех колонок)
// Игнорируем L/B/szt, берём из остальных колонок то, что похоже на тип.
export function pickTypeCandidateFromRow(rowObj, ignoreKeys = []) {
  const ignore = new Set(ignoreKeys.map(k => String(k).toLowerCase()));

  // 1) приоритет — колонки, которые явно похожи на тип
  const preferredKey = Object.keys(rowObj).find((k) => {
    const kk = String(k).toLowerCase();
    if (ignore.has(kk)) return false;
    return /typ|type|rodzaj|spec|mata|krat|oczko|plask/.test(kk);
  });
  if (preferredKey) return rowObj[preferredKey];

  // 2) иначе ищем значение, где есть NxM или слова płaskownik/oczko
  for (const k of Object.keys(rowObj)) {
    const kk = String(k).toLowerCase();
    if (ignore.has(kk)) continue;
    const v = String(rowObj[k] ?? "").trim();
    if (!v) continue;

    if (/[×x]\s*\d/.test(v)) return v;
    if (/płaskownik|plaskownik|oczko|krat|krata/i.test(v)) return v;
  }

  return "";
}
