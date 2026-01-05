import { useEffect, useMemo, useRef, useState } from "react";

import { calculateCuts } from "@/shared/core/cuts";

import type { GridView } from "../core/gridTypes";
import { importFileToGridView } from "../model/importOrders";
import type { OrderRow } from "../model/importOrders";
import { resolveOrdersFromGrid } from "../model/resolveTypes";
import { useCutsSettings } from "../model/useCutsSettings";
import { exportCutsXlsx } from "../model/exportCuts";

import { RaportCiecia } from "../report/ui/RaportCiecia";

import { CutsToolbar } from "./CutsToolbar";
import { CutsImportModal } from "./CutsImportModal";
import { CutsSettingsModal } from "./CutsSettingsModal";

type OrderNormalized = {
  L: number;
  B: number;
  count: number;
  /** Стабильный ключ типа (пока опционально) */
  typKey?: string;
};

const SESSION_KEY = "kc.cuts.session.v1";

const EMPTY_ROWS: OrderRow[] = [{ L: "", B: "", count: "" }];

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function normalizeRowsToOrders(rows: OrderRow[]): OrderNormalized[] {
  const res: OrderNormalized[] = [];
  (rows || []).forEach((r) => {
    const L = toNumber(r.L);
    const B = toNumber(r.B);
    const count = Math.max(1, Math.floor(toNumber(r.count) || 0));
    if (!(L > 0 && B > 0 && count > 0)) return;
    res.push({ L, B, count });
  });
  return res;
}

function defaultGridFromRows(rows: OrderRow[]): GridView {
  // Ключи должны быть стабильны, чтобы resize не сбрасывался.
  const columns = [
    { key: "L", title: "L" },
    { key: "B", title: "B" },
    { key: "szt", title: "szt" },
  ];

  const gridRows = (rows?.length ? rows : EMPTY_ROWS).map((r) => ({
    L: r.L ?? "",
    B: r.B ?? "",
    szt: r.count ?? "",
  }));

  return {
    columns,
    rows: gridRows,
  };
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function ensureXlsxExt(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "raport_rozkroj.xlsx";
  return trimmed.toLowerCase().endsWith(".xlsx") ? trimmed : `${trimmed}.xlsx`;
}

export function CutsPage() {
  const settings = useCutsSettings();
  const { calcOptions } = settings;

  // Manual L/B/szt as plain rows (we keep it because calc ядро ждёт orders).
  const [rows, setRows] = useState<OrderRow[]>(EMPTY_ROWS);

  // Import grid (как в файле). If null => работаем через manualGrid.
  const [importGrid, setImportGrid] = useState<GridView | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  // Manual editable grid (в модалке “Tabela”, когда файл не загружен)
  const [manualGrid, setManualGrid] = useState<GridView>(() => defaultGridFromRows(EMPTY_ROWS));

  // Draft in modal (чтобы отмена закрытия не портила состояние)
  const [tableDraft, setTableDraft] = useState<GridView | null>(null);
  const [openTable, setOpenTable] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Restore session snapshot (switching tabs should not wipe input) ----
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as {
        importGrid?: GridView;
        importFileName?: string;
        manualGrid?: GridView;
        rows?: OrderRow[];
        hadResult?: boolean;
      };

      if (snap.manualGrid) setManualGrid(snap.manualGrid);
      if (snap.rows && Array.isArray(snap.rows) && snap.rows.length) setRows(snap.rows);
      if (snap.importGrid) setImportGrid(snap.importGrid);
      if (typeof snap.importFileName === "string") setImportFileName(snap.importFileName);

      // Восстанавливаем результат не из JSON, а пересчётом (чтобы не сериализовать Maps и т.п.).
      if (snap.hadResult) {
        // Запланируем пересчёт на следующий тик — после применения state.
        setTimeout(() => {
          try {
            const input = snap.importGrid
              ? (resolveOrdersFromGrid(snap.importGrid).orders as OrderNormalized[])
              : normalizeRowsToOrders(snap.rows || []);
            const r = calculateCuts(input, calcOptions);
            setResult(r);
          } catch {
            // тихо: если не вышло — пользователь просто нажмёт “Oblicz”
          }
        }, 0);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist snapshot
  const persistBlockRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current) return;
    if (persistBlockRef.current) return;
    try {
      const snap = {
        importGrid: importGrid ?? undefined,
        importFileName: importFileName ?? undefined,
        manualGrid,
        rows,
        hadResult: !!result,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap));
    } catch {
      // ignore
    }
  }, [importGrid, importFileName, manualGrid, rows, result]);

  // ---- Derived input ----
  const activeGrid: GridView = useMemo(() => {
    return importGrid ?? manualGrid;
  }, [importGrid, manualGrid]);

  const resolved = useMemo(() => {
    if (importGrid) {
      try {
        const s = resolveOrdersFromGrid(importGrid) as any;
        return {
          orders: (s.orders || []) as OrderNormalized[],
          byTyp: (s.byTyp || new Map()) as Map<string, OrderNormalized[]>,
          error: null as string | null,
        };
      } catch (e: any) {
        return {
          orders: [] as OrderNormalized[],
          byTyp: new Map<string, OrderNormalized[]>(),
          error: e?.message || String(e),
        };
      }
    }

    const list = normalizeRowsToOrders(rows);
    const byTyp = new Map<string, OrderNormalized[]>();
    byTyp.set("domyślny", list);
    return { orders: list, byTyp, error: null as string | null };
  }, [importGrid, rows]);

  const totalCount = useMemo(() => {
    return (resolved.orders || []).reduce((acc, o) => acc + (Number(o.count) || 0), 0);
  }, [resolved.orders]);

  const canCalc = resolved.orders.length > 0 && !resolved.error;
  const canExport = !!result;
  const canClear = !!result || !!importGrid || (rows || []).some((r) => String(r.L || r.B || r.count || "").trim() !== "");

  function runCalc() {
    setError(null);
    if (resolved.error) {
      setError(resolved.error);
      return;
    }
    if (!resolved.orders.length) {
      setError("Brak danych do obliczeń. Wprowadź L/B/szt w tabeli.");
      return;
    }
    try {
      const r = calculateCuts(resolved.orders, calcOptions);
      setResult(r);
    } catch (e: any) {
      setResult(null);
      setError(e?.message || String(e));
    }
  }

  async function onPickFile(file: File) {
    setError(null);
    const { gridView } = await importFileToGridView(file);

    // Важно: сохраняем именно gridView (как в файле) — редактирование будет в модалке.
    setImportGrid(gridView);
    setImportFileName(file.name);

    // Как раньше: сразу считаем
    try {
      const s = resolveOrdersFromGrid(gridView) as any;
      const orders = (s.orders || []) as OrderNormalized[];

      // синхронизируем simple rows (чтобы summary/экспорт не пустовали)
      const nextRows: OrderRow[] = orders.map((o) => ({
        L: String(o.L),
        B: String(o.B),
        count: String(o.count),
      }));
      setRows(nextRows.length ? nextRows : EMPTY_ROWS);

      if (orders.length) {
        const r = calculateCuts(orders, calcOptions);
        setResult(r);
      } else {
        setResult(null);
      }
    } catch (e: any) {
      setResult(null);
      setError(e?.message || String(e));
    }
  }

  function openTableModal() {
    // Перед открытием берём текущий источник данных и делаем черновик.
    const base = importGrid ?? manualGrid ?? defaultGridFromRows(rows);
    setTableDraft(deepClone(base));
    setOpenTable(true);
  }

  function applyTableDraft() {
    if (!tableDraft) return;
    setError(null);

    // Если файл загружен — редактируем его grid.
    if (importGrid) {
      setImportGrid(tableDraft);
      try {
        const s = resolveOrdersFromGrid(tableDraft) as any;
        const orders = (s.orders || []) as OrderNormalized[];
        const nextRows: OrderRow[] = orders.map((o) => ({
          L: String(o.L),
          B: String(o.B),
          count: String(o.count),
        }));
        setRows(nextRows.length ? nextRows : EMPTY_ROWS);
        if (!orders.length) {
          setResult(null);
        } else {
          const r = calculateCuts(orders, calcOptions);
          setResult(r);
        }
      } catch (e: any) {
        setResult(null);
        setError(e?.message || String(e));
      }
    } else {
      // Manual режим: редактируем manualGrid и обновляем rows.
      setManualGrid(tableDraft);
      try {
        const s = resolveOrdersFromGrid(tableDraft) as any;
        const orders = (s.orders || []) as OrderNormalized[];
        const nextRows: OrderRow[] = orders.map((o) => ({
          L: String(o.L),
          B: String(o.B),
          count: String(o.count),
        }));
        setRows(nextRows.length ? nextRows : EMPTY_ROWS);

        if (!orders.length) {
          setResult(null);
        } else {
          const r = calculateCuts(orders, calcOptions);
          setResult(r);
        }
      } catch (e: any) {
        setResult(null);
        setError(e?.message || String(e));
      }
    }

    setOpenTable(false);
  }

  function clearAll() {
    setError(null);
    setResult(null);

    setImportGrid(null);
    setImportFileName(null);

    setRows(EMPTY_ROWS);
    setManualGrid(defaultGridFromRows(EMPTY_ROWS));
    setTableDraft(null);
    setOpenTable(false);

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  async function onExportXlsx() {
    if (!result) return;
    const suggested = importFileName
      ? ensureXlsxExt(importFileName.replace(/\.(xls|xlsx|csv)$/i, ""))
      : "raport_rozkroj.xlsx";
    const name = window.prompt("Nazwa pliku XLSX", suggested);
    if (name == null) return;
    const fileName = ensureXlsxExt(name);

    await exportCutsXlsx({
      result,
      sheetWidth: calcOptions.sheetWidth,
      fileName,
      gridView: activeGrid,
      anti: calcOptions.anti || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold text-white">Kalkulator Cięcia</div>

        {!importGrid ? (
          <div className="mt-1 text-sm text-white/70">
            Importuj tabelę (CSV/XLS/XLSX), edytuj ją jak w Excelu w oknie “Tabela”, a potem policz i wyeksportuj raport.
          </div>
        ) : (
          <div className="mt-1 text-sm">
            <span className="text-white/70">Wczytano plik:</span>{" "}
            <span className="font-semibold text-emerald-300">{importFileName || "(bez nazwy)"}</span>
          </div>
        )}
      </div>

      <CutsToolbar
        canCalc={canCalc}
        canExport={canExport}
        canClear={canClear}
        onPickFile={onPickFile}
        onOpenTable={openTableModal}
        onCalc={runCalc}
        onExportXlsx={onExportXlsx}
        onClear={clearAll}
        onOpenSettings={() => setOpenSettings(true)}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Pozycje L/B</div>
          <div className="mt-1 text-xl font-semibold text-white">{resolved.orders.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Sztuk</div>
          <div className="mt-1 text-xl font-semibold text-white">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Typów</div>
          <div className="mt-1 text-xl font-semibold text-white">{resolved.byTyp.size}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Szerokość arkusza</div>
          <div className="mt-1 text-xl font-semibold text-white">{calcOptions.sheetWidth} mm</div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">{error}</div> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Raport cięcia</div>
        <div className="mt-3">
          <RaportCiecia result={result} />
        </div>
      </div>

      <CutsImportModal
        open={openTable}
        fileName={importGrid ? importFileName : null}
        grid={tableDraft ?? activeGrid}
        onGridChange={(g) => setTableDraft(g)}
        onClose={() => {
          setOpenTable(false);
          setTableDraft(null);
        }}
        onApply={applyTableDraft}
      />

      <CutsSettingsModal open={openSettings} onClose={() => setOpenSettings(false)} state={settings} />
    </div>
  );
}
