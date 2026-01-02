import { useEffect, useState } from "react";

/**
 * Legacy-boolean storage: "1" / "0"
 * (как было в старом settings.js для settings_fallback).
 */
export function useLsBool01(key: string, fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return raw === "1";
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
