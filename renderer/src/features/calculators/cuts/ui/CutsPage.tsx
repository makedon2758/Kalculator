import { useMemo, useRef, useState } from "react";
import { calculateCuts } from "@/shared/core/cuts";
import { SettingsModal } from "@/features/calculators/common/ui/SettingsModal";
import { importFileToOrders } from "../model/importOrders";
import { exportCutsXlsx } from "../model/exportCuts";
import { useCutsSettings } from "../model/useCutsSettings";
import { RaportCiecia } from "../report/ui/RaportCiecia";

type OrderRow = { L: number; B: number; count: number };

export function CutsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OrderRow[]>([{ L: 0, B: 0, count: 1 }]);
  const [rawResult, setRawResult] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  const s = useCutsSettings();

  const orders = useMemo(
    () => rows.filter((r) => r.L > 0 && r.B > 0 && r.count > 0),
    [rows]
  );

  function updateRow(idx: number, patch: Partial<OrderRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function addRow() {
    setRows((prev) => prev.concat({ L: 0, B: 0, count: 1 }));
    setDirty(true);
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      if (prev.length === 1) return [{ L: 0, B: 0, count: 1 }];
      return prev.filter((_, i) => i !== idx);
    });
    setDirty(true);
  }

  function runCalc(nextOrders = orders) {
    if (!nextOrders.length) {
      setRawResult(null);
      setDirty(false);
      return;
    }

    const res = calculateCuts(nextOrders, {
      sheetWidth: s.parsed.sheetWidth,
      toleranceL: s.parsed.toleranceL,
      allowFallback: s.parsed.allowFallback,
      minLeftover: s.parsed.minLeftover,
      tailWantedB: s.parsed.tailWantedB,
      orderByRemainder: false,
      anti: s.parsed.anti,
    });

    setRawResult(res);
    setDirty(false);
  }

  async function onImportClick() {
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // чтобы можно было импортить тот же файл повторно
    if (!file) return;

    try {
      const imported = await importFileToOrders(file);
      setRows(imported.orders.map((o: OrderRow) => ({
        L: o.L,
        B: o.B,
        count: o.count,
      })));
      // 1:1 как раньше: после импорта сразу считаем
      runCalc(imported.orders);
    } catch (err: any) {
      alert(err?.message ?? String(err));
    }
  }

  async function onExportXlsx() {
    if (!rawResult) return;

    await exportCutsXlsx({
      result: rawResult,
      sheetWidth: s.parsed.sheetWidth,
      anti: s.parsed.anti,
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-white/90">Kalkulator</div>
          <div className="text-sm text-white/60">
            Wprowadź L / B / szt i zobacz wynik
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            id="file-xlsx-csv"
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFileChange}
          />

          <button
            id="btn-import"
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            onClick={onImportClick}
          >
            Import
          </button>

          <button
            id="btn-export-xlsx"
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06] disabled:opacity-40"
            onClick={onExportXlsx}
            disabled={!rawResult || dirty}
            title={dirty ? "Najpierw kliknij Oblicz" : ""}
          >
            Export XLSX
          </button>

          <button
            id="btn-calc"
            type="button"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            onClick={() => runCalc()}
          >
            Oblicz
          </button>

          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            onClick={() => setOpen(true)}
          >
            ⚙️ Ustawienia
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid grid-cols-[140px_140px_120px_1fr] gap-2 text-sm font-semibold text-white/70">
          <div>L</div>
          <div>B</div>
          <div>szt</div>
          <div />
        </div>

        {rows.map((r, idx) => (
          <div key={idx} className="mt-2 grid grid-cols-[140px_140px_120px_1fr] gap-2">
            <input
              className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={r.L}
              onChange={(e) => updateRow(idx, { L: Number(e.target.value) || 0 })}
            />
            <input
              className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={r.B}
              onChange={(e) => updateRow(idx, { B: Number(e.target.value) || 0 })}
            />
            <input
              className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={r.count}
              onChange={(e) => updateRow(idx, { count: Number(e.target.value) || 0 })}
            />

            <div className="flex gap-2">
              <button
                type="button"
                className="h-10 w-12 rounded-xl border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
                onClick={addRow}
              >
                +
              </button>
              <button
                type="button"
                className="h-10 w-12 rounded-xl border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
                onClick={() => removeRow(idx)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report */}
      {!rawResult ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
          Brak danych do obliczenia.
        </div>
      ) : (
        <RaportCiecia result={rawResult} />
      )}

      {/* Settings */}
      <SettingsModal open={open} title="Ustawienia — Kalkulator" onClose={() => setOpen(false)}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Szukany ogonek w złomie (B, mm)">
            <input
              id="wantedScrapB"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={s.tailWantedBStr}
              onChange={(e) => s.setTailWantedBStr(e.target.value)}
            />
          </Field>

          <Field label="Tolerancja długości L, mm (w dół)">
            <input
              id="toleranceL"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={s.toleranceLStr}
              onChange={(e) => s.setToleranceLStr(e.target.value)}
            />
          </Field>

          <Field label="Minimalna szerokość resztki (mm)">
            <input
              id="minLeftover"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={s.minLeftoverStr}
              onChange={(e) => s.setMinLeftoverStr(e.target.value)}
            />
          </Field>

          <Field label="Szerokość maty (W, mm)" className="md:col-span-1">
            <input
              id="sheetWidth"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25"
              value={s.sheetWidthStr}
              onChange={(e) => s.setSheetWidthStr(e.target.value)}
            />
          </Field>
        </div>

        <div
          id="anti-card"
          className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/90">
                Włącz reguły anty-marnotrawstwa
              </div>
              <div className="text-sm text-white/60">
                — ograniczaj sklejki / szukaj złomu
              </div>
            </div>

            <label className="inline-flex items-center gap-3 cursor-pointer">
              <span className="text-sm text-white/80">ON</span>
              <input
                id="anti-enabled"
                type="checkbox"
                checked={s.antiEnabled}
                onChange={(e) => s.setAntiEnabled(e.target.checked)}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Nie ciąć detali, gdy L ≤ …">
              <input
                id="anti-minL"
                disabled={!s.antiEnabled}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25 disabled:opacity-40"
                value={s.antiMinL}
                onChange={(e) => s.setAntiMinL(e.target.value)}
                placeholder="np. 500"
              />
            </Field>

            <Field label="Nie składaj po B, gdy B > …">
              <input
                id="anti-limitB"
                disabled={!s.antiEnabled}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25 disabled:opacity-40"
                value={s.antiLimitB}
                onChange={(e) => s.setAntiLimitB(e.target.value)}
                placeholder="np. 800"
              />
            </Field>

            <Field label="…ale pozwól skleić do … ark. W (k)">
              <input
                id="anti-maxK"
                disabled={!s.antiEnabled}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25 disabled:opacity-40"
                value={s.antiMaxK}
                onChange={(e) => s.setAntiMaxK(e.target.value)}
                placeholder="np. 3"
              />
              <div className="mt-1 text-xs text-white/50">
                Jeśli puste — blokuj wszystkie sklejki, gdy B &gt; limit.
              </div>
            </Field>

            <Field label="Nie ciąć ostatniej formatki, gdy B ≤ …" className="md:col-span-2">
              <input
                id="anti-lastB"
                disabled={!s.antiEnabled}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white/90 outline-none focus:border-white/25 disabled:opacity-40"
                value={s.antiLastB}
                onChange={(e) => s.setAntiLastB(e.target.value)}
                placeholder="np. 250"
              />
              <div className="mt-1 text-xs text-white/50">
                Działa tylko dla ostatniej (niepełnej) formatki dla tego B.
              </div>
            </Field>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/90">
                Pozwól na fallback długości
              </div>
              <div className="text-sm text-white/60">— jeśli brak w tolerancji</div>
            </div>

            <input
              id="enableFallback"
              type="checkbox"
              checked={s.allowFallback}
              onChange={(e) => s.setAllowFallback(e.target.checked)}
            />
          </label>
        </div>
      </SettingsModal>
    </div>
  );
}

function Field({ label, children, className }: any) {
  return (
    <label className={["block", className ?? ""].join(" ")}>
      <div className="mb-2 text-sm text-white/70">{label}</div>
      {children}
    </label>
  );
}
