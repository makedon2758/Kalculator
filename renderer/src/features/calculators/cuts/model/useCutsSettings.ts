import { useLsBool01 } from "@/shared/settings/useLsBool01";
import { useLsNumber } from "@/shared/settings/useLsNumber";

const LS = {
  w: "settings_sheetWidth",
  tol: "settings_tolL",
  min: "settings_minLeftover",
  og: "settings_wantedScrapB",
  fb: "settings_fallback",

  antiOn: "settings_antiEnabled", // новый ключ (безопасно)
  antiMinL: "settings_antiMinL",
  antiLimB: "settings_antiLimitB",
  antiMaxK: "settings_antiMaxK",
  antiLastB: "settings_antiLastB",
};

export function useCutsSettings() {
  const [sheetWidth, setSheetWidth] = useLsNumber(LS.w, 1000);
  const [toleranceL, setToleranceL] = useLsNumber(LS.tol, 2);
  const [minLeftover, setMinLeftover] = useLsNumber(LS.min, 40);
  const [tailWantedB, setTailWantedB] = useLsNumber(LS.og, 50);
  const [allowFallback, setAllowFallback] = useLsBool01(LS.fb, false);

  const [antiEnabled, setAntiEnabled] = useLsBool01(LS.antiOn, false);
  const [antiMinL, setAntiMinL] = useLsNumber(LS.antiMinL, 0);
  const [antiLimB, setAntiLimB] = useLsNumber(LS.antiLimB, 0);
  const [antiMaxK, setAntiMaxK] = useLsNumber(LS.antiMaxK, 0);
  const [antiLastB, setAntiLastB] = useLsNumber(LS.antiLastB, 0);

  const anti: any = { enabled: antiEnabled };
  if (antiEnabled) {
    if (antiMinL > 0) anti.minLNoCut = antiMinL;
    if (antiLimB > 0) anti.limitMergeB = antiLimB;
    if (antiMaxK > 0) anti.maxMergeK = antiMaxK;
    if (antiLastB > 0) anti.lastNoCutB = antiLastB;
  }

  const calcOptions = {
    sheetWidth,
    toleranceL,
    allowFallback,
    minLeftover,
    tailWantedB,
    orderByRemainder: false as const, // 1:1 (пока фиксируем)
    anti,
  };

  return {
    sheetWidth, setSheetWidth,
    toleranceL, setToleranceL,
    minLeftover, setMinLeftover,
    tailWantedB, setTailWantedB,
    allowFallback, setAllowFallback,

    antiEnabled, setAntiEnabled,
    antiMinL, setAntiMinL,
    antiLimB, setAntiLimB,
    antiMaxK, setAntiMaxK,
    antiLastB, setAntiLastB,

    calcOptions,
  };
}
