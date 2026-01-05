import { SettingsModal } from "@/features/calculators/common/ui/SettingsModal";
import { useCutsSettings } from "../model/useCutsSettings";

type CutsSettingsState = ReturnType<typeof useCutsSettings>;

export function CutsSettingsModal({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: CutsSettingsState;
}) {
  const {
    sheetWidth,
    toleranceL,
    minLeftover,
    tailWantedB,
    allowFallback,

    antiEnabled,
    antiMinL,
    antiLimB,
    antiMaxK,
    antiLastB,

    setSheetWidth,
    setToleranceL,
    setMinLeftover,
    setTailWantedB,
    setAllowFallback,

    setAntiEnabled,
    setAntiMinL,
    setAntiLimB,
    setAntiMaxK,
    setAntiLastB,
  } = state;

  return (
    <SettingsModal open={open} title="Ustawienia — Kalkulator (1D)" onClose={onClose} size="xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Szukany ogonek w złomie (B, mm)</span>
          <input
            id="wantedScrapB"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            value={tailWantedB}
            onChange={(e) => setTailWantedB(Number(e.target.value) || 0)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Tolerancja długości L, mm (w dół)</span>
          <input
            id="toleranceL"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            value={toleranceL}
            onChange={(e) => setToleranceL(Number(e.target.value) || 0)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Minimalna szerokość resztki (mm)</span>
          <input
            id="minLeftover"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            value={minLeftover}
            onChange={(e) => setMinLeftover(Number(e.target.value) || 0)}
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-3">
          <span className="text-white/80">Szerokość maty (W, mm)</span>
          <input
            id="sheetWidth"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            value={sheetWidth}
            onChange={(e) => setSheetWidth(Number(e.target.value) || 0)}
          />
        </label>

        <div className="md:col-span-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Anty-marnotrawstwo</div>
              <div className="text-xs text-white/60">Blokady sklejania i reguły ostatniej formatki (jak w legacy).</div>
            </div>

            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                id="anti-enabled"
                type="checkbox"
                checked={antiEnabled}
                onChange={(e) => setAntiEnabled(e.target.checked)}
              />
              ON/OFF
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-white/80">Nie ciąć detali, gdy L ≤ …</span>
              <input
                id="anti-minL"
                disabled={!antiEnabled}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-40"
                value={antiMinL}
                onChange={(e) => setAntiMinL(Number(e.target.value) || 0)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-white/80">Nie składaj po B, gdy B &gt; …</span>
              <input
                id="anti-limitB"
                disabled={!antiEnabled}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-40"
                value={antiLimB}
                onChange={(e) => setAntiLimB(Number(e.target.value) || 0)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-white/80">…ale pozwól skleić do ark. W (k)</span>
              <input
                id="anti-maxK"
                disabled={!antiEnabled}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-40"
                value={antiMaxK}
                onChange={(e) => setAntiMaxK(Number(e.target.value) || 0)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-white/80">Nie ciąć ostatniej formatki, gdy B ≤ …</span>
              <input
                id="anti-lastB"
                disabled={!antiEnabled}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-40"
                value={antiLastB}
                onChange={(e) => setAntiLastB(Number(e.target.value) || 0)}
              />
            </label>
          </div>
        </div>

        <label className="md:col-span-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <input
            id="enableFallback"
            type="checkbox"
            checked={allowFallback}
            onChange={(e) => setAllowFallback(e.target.checked)}
          />
          <span className="text-white/90">Pozwól na fallback długości — jeśli brak w tolerancji</span>
        </label>
      </div>
    </SettingsModal>
  );
}
