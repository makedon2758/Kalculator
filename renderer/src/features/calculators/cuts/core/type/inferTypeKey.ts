// renderer/src/features/calculators/cuts/core/type/inferTypeKey.ts
// 1:1 порт из js/type.js

function clean(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/[×]/g, "x")
    .replace(/\s+/g, " ");
}

function compact(raw: unknown) {
  return clean(raw).toLowerCase().replace(/\s+/g, "");
}

// Возвращает массив пар { a, b, text } из "34x38/40x3"
function extractPairs(compactStr: string) {
  const out: Array<{ a: number; b: number; text: string }> = [];
  const re = /(\d{1,4})x(\d{1,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(compactStr))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    out.push({ a, b, text: `${a}x${b}` });
  }
  return out;
}

// Основная функция: делает стабильный ключ типа (или "" если не распознали)
export function inferTypeKey(raw: unknown): string {
  const s = clean(raw);
  if (!s) return "";

  const lc = s.toLowerCase();
  const c = compact(s);

  const hasOczko = /oczko|oczek|oko|mesh|krat|krata|kratka|oczka/.test(lc);
  const hasPlask = /płaskownik|plaskownik|flat|bearing\s*bar|plask/.test(lc);

  // 1) Если есть явный формат с "/" — сохраняем как "A/B"
  if (c.includes("/")) {
    const parts = c.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const p1 = extractPairs(parts[0])[0]?.text;
      const p2 = extractPairs(parts[1])[0]?.text;
      if (p1 && p2) return `${p1}/${p2}`;
    }
  }

  // 2) Ищем пары NxM
  const pairs = extractPairs(c);

  // Если пар нет — но есть ключевые слова
  if (!pairs.length) {
    if (hasPlask) return "płaskownik";
    if (hasOczko) return "oczko";
    return clean(raw);
  }

  // 3) Эвристика: oczko "две большие", płaskownik "вторая маленькая"
  const opening = pairs.find((p) => p.a >= 10 && p.b >= 10);
  const flatbar = pairs.find((p) => p.a >= 10 && p.b > 0 && p.b < 10);

  if (opening && flatbar) return `${opening.text}/${flatbar.text}`;

  if (hasPlask) return `płaskownik ${flatbar?.text ?? pairs[0].text}`;
  if (hasOczko) return `oczko ${opening?.text ?? pairs[0].text}`;

  return pairs[0].text;
}

// Берём из остальных колонок то, что похоже на тип.
export function pickTypeCandidateFromRow(
  rowObj: Record<string, unknown>,
  ignoreKeys: string[] = []
): string {
  const ignore = new Set(ignoreKeys.map((k) => String(k).toLowerCase()));

  // 1) приоритет — колонки, похожие на тип
  const preferredKey = Object.keys(rowObj).find((k) => {
    const kk = String(k).toLowerCase();
    if (ignore.has(kk)) return false;
    return /typ|type|rodzaj|spec|mata|krat|oczko|plask/.test(kk);
  });
  if (preferredKey) return String(rowObj[preferredKey] ?? "");

  // 2) иначе ищем NxM или слова
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
