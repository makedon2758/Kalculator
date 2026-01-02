import { useMemo } from "react";
import { useLsState } from "@/shared/settings/useLsState";

type AntiUi = {
  enabled: boolean;
  minL: string;     // anti-minL
  limitB: string;   // anti-limitB
  maxK: string;     // anti-maxK
  lastB: string;    // anti-lastB
};

const LS = {
  sheetWidth: "settings_sheetWidth",
  toleranceL: "settings_toleranceL",
  minLeftover: "settings_minLeftover",
  tailWantedB: "settings_tailWantedB",
  allowFallback: "settings_allowFallback",

  antiEnabled: "settings_antiEnabled",
  antiMinL: "settings_antiMinL",
  antiLimitB: "settings_antiLimitB",
  antiMaxK: "settings_antiMaxK",
  antiLastB: "settings_antiLastB",
} as const;

function toNum(s: string, fallback: number) {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function toNumOrNull(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function useCutsSettings() {
  // значения как строки — чтобы 1:1 повторить legacy (пусто / нечисло)
  const [sheetWidthStr, setSheetWidthStr] = useLsState<string>(LS.sheetWidth, "1000");
  const [toleranceLStr, setToleranceLStr] = useLsState<string>(LS.toleranceL, "2");
  const [minLeftoverStr, setMinLeftoverStr] = useLsState<string>(LS.minLeftover, "60");
  const [tailWantedBStr, setTailWantedBStr] = useLsState<string>(LS.tailWantedB, "50");

  const [allowFallback, setAllowFallback] = useLsState<boolean>(LS.allowFallback, false);

  const [antiEnabled, setAntiEnabled] = useLsState<boolean>(LS.antiEnabled, false);
  const [antiMinL, setAntiMinL] = useLsState<string>(LS.antiMinL, "");
  const [antiLimitB, setAntiLimitB] = useLsState<string>(LS.antiLimitB, "");
  const [antiMaxK, setAntiMaxK] = useLsState<string>(LS.antiMaxK, "");
  const [antiLastB, setAntiLastB] = useLsState<string>(LS.antiLastB, "");

  const parsed = useMemo(() => {
    const sheetWidth = toNum(sheetWidthStr, 1000);
    const toleranceL = toNum(toleranceLStr, 2);
    const minLeftover = toNum(minLeftoverStr, 60);
    const tailWantedB = toNum(tailWantedBStr, 50);

    const anti: any = { enabled: antiEnabled };
    if (antiEnabled) {
      const vMinL = toNumOrNull(antiMinL);
      const vLimitB = toNumOrNull(antiLimitB);
      const vMaxK = toNumOrNull(antiMaxK);
      const vLastB = toNumOrNull(antiLastB);

      if (vMinL && vMinL > 0) anti.minLNoCut = vMinL;
      if (vLimitB && vLimitB > 0) anti.limitMergeB = vLimitB;

      // ВАЖНО: пусто => null, но legacy трактовал “пусто/0” как блок при B>limit.
      // calc.js сам решает (getMaxForeign), поэтому передаём как есть (0 тоже валиден).
      if (vMaxK !== null) anti.maxMergeK = vMaxK;

      if (vLastB && vLastB > 0) anti.lastNoCutB = vLastB;
    }

    return {
      sheetWidth,
      toleranceL,
      minLeftover,
      tailWantedB,
      allowFallback,
      anti,
    };
  }, [
    sheetWidthStr,
    toleranceLStr,
    minLeftoverStr,
    tailWantedBStr,
    allowFallback,
    antiEnabled,
    antiMinL,
    antiLimitB,
    antiMaxK,
    antiLastB,
  ]);

  return {
    // UI (строки/булевы, чтобы не терять “пусто”)
    sheetWidthStr, setSheetWidthStr,
    toleranceLStr, setToleranceLStr,
    minLeftoverStr, setMinLeftoverStr,
    tailWantedBStr, setTailWantedBStr,
    allowFallback, setAllowFallback,

    antiEnabled, setAntiEnabled,
    antiMinL, setAntiMinL,
    antiLimitB, setAntiLimitB,
    antiMaxK, setAntiMaxK,
    antiLastB, setAntiLastB,

    // parsed options (для calculateCuts 1:1)
    parsed,
  };
}
