import { useEffect, useMemo, useRef, useState } from "react";

import type { GridColumn, GridRow, GridView } from "../../core/gridTypes";

type Props = {
  grid: GridView;
  onChange: (next: GridView) => void;
  className?: string;

  /**
   * Разрешить добавление строк (кнопка “+” внизу таблицы).
   * Для режима read-only (позже) можно выключать.
   */
  canAddRows?: boolean;
  onAddRow?: () => void;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function guessWidth(title: string): number {
  const len = String(title || "").length;
  // компактно, но чтобы заголовки были читаемыми
  return clamp(80 + len * 7, 90, 420);
}

function isEmptyRow(row: GridRow, columns: GridColumn[]): boolean {
  return columns.every((c) => {
    const v = row?.[c.key];
    return v == null || String(v).trim() === "";
  });
}

export function OrdersGrid({ grid, onChange, className, canAddRows = true, onAddRow }: Props) {
  const columns = grid.columns || [];
  const rows = grid.rows || [];

  // ширины колонок (в px)
  const [colW, setColW] = useState<Record<string, number>>({});

  // гарантируем наличие ширин для новых колонок
  useEffect(() => {
    setColW((prev) => {
      const next = { ...prev };
      for (const c of columns) {
        if (!Number.isFinite(next[c.key])) next[c.key] = guessWidth(c.title);
      }
      // чистим мусор (колонка удалена)
      Object.keys(next).forEach((k) => {
        if (!columns.some((c) => c.key === k)) delete next[k];
      });
      return next;
    });
  }, [columns]);

  // inline-редактирование заголовков
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // resize
  const resizeRef = useRef<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return;
      const { key, startX, startW } = resizeRef.current;
      const dx = e.clientX - startX;
      setColW((prev) => ({ ...prev, [key]: clamp(startW + dx, 60, 900) }));
      e.preventDefault();
    }
    function onUp() {
      resizeRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(colKey: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startW = Number(colW[colKey] ?? guessWidth(columns.find((c) => c.key === colKey)?.title || ""));
    resizeRef.current = { key: colKey, startX: e.clientX, startW };
  }

  function setCell(rIdx: number, colKey: string, value: string) {
    const next = deepClone(grid);
    next.rows = next.rows || [];
    next.rows[rIdx] = { ...(next.rows[rIdx] || {}), [colKey]: value };
    onChange(next);
  }

  function removeRow(rIdx: number) {
    const next = deepClone(grid);
    next.rows = (next.rows || []).filter((_, i) => i !== rIdx);
    // Excel-like: если осталась 0 строк — оставим 1 пустую
    if (next.rows.length === 0) {
      const empty: GridRow = {};
      columns.forEach((c) => (empty[c.key] = ""));
      next.rows = [empty];
    }
    onChange(next);
  }

  function applyTitle() {
    const key = editingColKey;
    if (!key) return;
    const next = deepClone(grid);
    next.columns = (next.columns || []).map((c) => (c.key === key ? { ...c, title: editingTitle } : c));
    onChange(next);
    setEditingColKey(null);
    setEditingTitle("");
  }

  function cancelTitle() {
    setEditingColKey(null);
    setEditingTitle("");
  }

  // Авто-рост textarea по высоте (как в Excel при переносе)
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${Math.min(240, Math.max(36, el.scrollHeight))}px`;
  }

  const hasRealData = useMemo(() => {
    return rows.some((r) => !isEmptyRow(r, columns));
  }, [rows, columns]);

  return (
    <div className={className || ""}>
      <div className="overflow-auto rounded-xl border border-white/10 bg-black/10">
        <table className="w-full table-fixed text-sm">
          {/*
            Важно: colgroup — единственный источник ширин.
            Так можно уменьшать/увеличивать колонки независимо от исходной ширины.
          */}
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: colW[c.key] ?? guessWidth(c.title) }} />
            ))}
            {/* колонка действий */}
            <col style={{ width: 44 }} />
          </colgroup>

          <thead className="sticky top-0 z-10 bg-zinc-900/90 text-white">
            <tr>
              {columns.map((c) => {
                const isEditing = editingColKey === c.key;
                return (
                  <th key={c.key} className="relative border-b border-white/10 px-2 py-2 align-top">
                    {!isEditing ? (
                      <button
                        type="button"
                        className="w-full select-none text-left font-semibold text-white/90"
                        title="Dwukliknij, aby zmienić nazwę kolumny"
                        onDoubleClick={() => {
                          setEditingColKey(c.key);
                          setEditingTitle(c.title);
                        }}
                      >
                        <span className="block break-words">{c.title}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyTitle();
                            if (e.key === "Escape") cancelTitle();
                          }}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-white"
                        />
                        <button
                          type="button"
                          onClick={applyTitle}
                          className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                          title="Zapisz"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={cancelTitle}
                          className="rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15"
                          title="Anuluj"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* resize handle */}
                    <div
                      onMouseDown={(e) => startResize(c.key, e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      title="Przeciągnij, aby zmienić szerokość"
                    />
                  </th>
                );
              })}

              <th className="border-b border-white/10 px-2 py-2 text-center text-xs font-semibold text-white/60">
                {/* actions */}
              </th>
            </tr>
          </thead>

          <tbody className="text-white/90">
            {rows.map((r, rIdx) => (
              <tr key={rIdx} className="border-t border-white/10">
                {columns.map((c) => {
                  const value = r?.[c.key] ?? "";
                  return (
                    <td key={c.key} className="px-2 py-1 align-top">
                      <textarea
                        value={String(value)}
                        onChange={(e) => {
                          setCell(rIdx, c.key, e.target.value);
                          autoGrow(e.currentTarget);
                        }}
                        onInput={(e) => autoGrow(e.currentTarget as HTMLTextAreaElement)}
                        rows={1}
                        className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      />
                    </td>
                  );
                })}

                <td className="px-1 py-1 align-top text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rIdx)}
                    className="rounded-md bg-white/10 px-2 py-2 text-xs text-white/80 hover:bg-white/15"
                    title="Usuń wiersz"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {/* Excel-like: плюсик как отдельная “строка” внизу */}
            {canAddRows ? (
              <tr className="border-t border-white/10">
                <td colSpan={columns.length + 1} className="p-2">
                  <button
                    type="button"
                    onClick={onAddRow}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    <span className="text-lg">＋</span>
                    <span>Dodaj wiersz</span>
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* маленькая подсказка */}
      <div className="mt-2 text-xs text-white/50">
        Podpowiedź: dwuklik w nagłówek → zmiana nazwy kolumny, przeciągnij krawędź → zmiana szerokości.
        {hasRealData ? null : <span className="ml-2 text-white/40">(tabela jest pusta)</span>}
      </div>
    </div>
  );
}
