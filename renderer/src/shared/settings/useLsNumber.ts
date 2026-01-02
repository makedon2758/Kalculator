import { useEffect, useState } from "react";

/**
 * Legacy-number storage: value хранится как строка "1000", "2" и т.п.
 * (как было в старом settings.js). Без JSON.
 */
export function useLsNumber(key: string, fallback: number) {
  const [value, setValue] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
