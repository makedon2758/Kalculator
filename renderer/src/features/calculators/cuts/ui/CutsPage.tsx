import { useRef, useState } from "react";
import { calculateCuts } from "@/shared/core/cuts";
import { SettingsModal } from "@/features/calculators/common/ui/SettingsModal";
import { importFileToGridView } from "../model/importOrders";
import { exportCutsXlsx } from "../model/exportCuts";
import { useCutsSettings } from "../model/useCutsSettings";
import { resolveOrdersFromGrid } from "../model/resolveTypes";
import { RaportCiecia } from "../report/ui/RaportCiecia";
import type { GridView } from "../core/gridTypes";
import { OrdersGrid } from "./OrdersGrid/OrdersGrid";

type OrderRow = { L: number; B: number; count: number };

export function CutsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [openSettings, setOpenSettings] = useState(false);

  // простой ввод (если импорта нет)
  const [rows, setRows] = useState<OrderRow[]>([{ L: 0, B: 0, count: 1 }]);

  // результат считаем только по кнопке + автосчёт после импорта
  const [rawResult, setRawResult] = useState<any | null>(null);

  // импорт-грид (редактируемая таблица из файла)
  const [importGrid, setImportGrid] = useState<GridView | null>(null);
  const [importMeta, setImportMeta] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [openImport, setOpenImport] = useState(false);

  // ✅ ЧИСЛОВОЙ хук (как в твоём "оригинальном" коде)
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

    calcOptions,
  } = useCutsSettings();

  

  function updateRow(idx: number, patch: Partial<OrderRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => prev.concat({ L: 0, B: 0, count: 1 }));
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      if (prev.length === 1) return [{ L: 0, B: 0, count: 1 }];
      return prev.filter((_, i) => i !== idx);
    });
  }

  function runCalc(nextOrders: OrderRow[] | null = null) {
    const useOrders =
      nextOrders ??
      rows
        .map((r) => ({
          L: Number(r.L) || 0,
          B: Number(r.B) || 0,
          count: Number(r.count) || 0,
        }))
        .filter((r) => r.L > 0 && r.B > 0 && r.count > 0);

    const res = calculateCuts(useOrders as any, calcOptions);
    setRawResult(res);
    return res;
  }

  async function onFilePicked(file: File) {
    // 1) читаем файл -> gridView
    const { gridView, meta } = await importFileToGridView(file);

    setImportGrid(gridView);
    setImportMeta(meta || {});
    setImportFileName(file.name);

    // 2) парсим заказы из gridView (тип/контекст — отдельно)
    const parsed = resolveOrdersFromGrid(gridView);

    const nextRows: OrderRow[] = (parsed.orders || []).map((o) => ({
      L: Number(o.L) || 0,
      B: Number(o.B) || 0,
      count: Number(o.count) || 0,
    }));

    setRows(nextRows.length ? nextRows : [{ L: 0, B: 0, count: 1 }]);

    // 3) как в legacy: после импорта сразу считаем
    const res = calculateCuts(nextRows as any, calcOptions);
    setRawResult(res);

    setImportMeta({ ...(meta || {}), ...(parsed.meta || {}) });
  }

  async function onExportXlsx() {
    const res = rawResult ?? runCalc();
    if (!res || res?.error) return;

    const antiForExport = calcOptions?.anti?.enabled
      ? { ...calcOptions.anti, forcedMap: res.forcedMap }
      : { ...(calcOptions?.anti || {}), forcedMap: new Map() };

    await exportCutsXlsx({
      result: res,
      sheetWidth,
      anti: antiForExport,
    });
  }

  function applyImportGridToOrders() {
    if (!importGrid) return;

    const parsed = resolveOrdersFromGrid(importGrid);

    const nextRows: OrderRow[] = (parsed.orders || []).map((o) => ({
      L: Number(o.L) || 0,
      B: Number(o.B) || 0,
      count: Number(o.count) || 0,
    }));

    setRows(nextRows.length ? nextRows : [{ L: 0, B: 0, count: 1 }]);

    const res = calculateCuts(nextRows as any, calcOptions);
    setRawResult(res);

    setImportMeta((prev: any) => ({ ...(prev || {}), ...(parsed.meta || {}) }));
    setOpenImport(false);
  }

  return (
    <div className="p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              await onFilePicked(f);
            } catch (err: any) {
              console.error(err);
              alert("Nie udało się odczytać pliku:\n" + (err?.message || err));
            }
          }}
        />

        <button
          className="rounded-xl border border-white/10 bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </button>

        {importGrid && (
          <button
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.09]"
            onClick={() => setOpenImport(true)}
            title="Edytuj tabelę importu"
          >
            Tabela
          </button>
        )}

        <button
          className="rounded-xl border border-white/10 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={onExportXlsx}
        >
          Export XLSX
        </button>

        <button
          className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.09]"
          onClick={() => runCalc()}
        >
          Oblicz
        </button>

        <button
          className="ml-auto rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.08]"
          onClick={() => setOpenSettings(true)}
        >
          ⚙️ Ustawienia
        </button>
      </div>

      {/* Info o imporcie */}
      {importFileName && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              Import: <span className="font-semibold">{importFileName}</span>
              {typeof importMeta?.skippedSteps === "number" && (
                <span className="ml-3 text-white/60">
                  (pominięto stopnie: {importMeta.skippedSteps})
                </span>
              )}
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.07]"
              onClick={() => {
                setImportGrid(null);
                setImportMeta(null);
                setImportFileName(null);
              }}
              title="Usuń powiązanie z importem"
            >
              Wyczyść import
            </button>
          </div>
        </div>
      )}

      {/* Ввод L/B/szt */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid grid-cols-[140px_140px_120px_1fr] gap-2 text-sm font-semibold text-white/80">
          <div>L</div>
          <div>B</div>
          <div>szt</div>
          <div />
        </div>

        {rows.map((r, idx) => (
          <div key={idx} className="mt-2 grid grid-cols-[140px_140px_120px_1fr] gap-2">
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              value={r.L}
              onChange={(e) => updateRow(idx, { L: Number(e.target.value) || 0 })}
            />
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              value={r.B}
              onChange={(e) => updateRow(idx, { B: Number(e.target.value) || 0 })}
            />
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              value={r.count}
              onChange={(e) => updateRow(idx, { count: Number(e.target.value) || 0 })}
            />

            <div className="flex gap-2">
              <button
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90 hover:bg-white/[0.08]"
                onClick={addRow}
              >
                +
              </button>
              <button
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90 hover:bg-white/[0.08]"
                onClick={() => removeRow(idx)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Raport */}
      <div className="mt-4">
        <RaportCiecia result={rawResult} />
      </div>

      {/* Modal: Import grid */}
      <SettingsModal open={openImport} title="Tabela importu — edycja" onClose={() => setOpenImport(false)}>
        {!importGrid ? (
          <div className="p-2 text-white/70">Brak danych importu.</div>
        ) : (
          <div className="space-y-4">
            <OrdersGrid grid={importGrid} onChange={setImportGrid} />

            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/90 hover:bg-white/[0.08]"
                onClick={() => setOpenImport(false)}
              >
                Zamknij
              </button>
              <button
                className="rounded-xl border border-white/10 bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                onClick={applyImportGridToOrders}
              >
                Zastosuj i oblicz
              </button>
            </div>
          </div>
        )}
      </SettingsModal>

      {/* Modal: Settings */}
      <SettingsModal open={openSettings} title="Ustawienia — Kalkulator (1D)" onClose={() => setOpenSettings(false)}>
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
                <div className="text-xs text-white/60">
                  Blokady sklejania i reguły ostatniej formatki (jak w legacy).
                </div>
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
            <span className="text-white/90">
              Pozwól na fallback długości — jeśli brak w tolerancji
            </span>
          </label>
        </div>
      </SettingsModal>
    </div>
  );
}
