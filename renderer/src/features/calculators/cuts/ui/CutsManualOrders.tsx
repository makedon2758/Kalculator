import type { OrderRow } from "../model/importOrders";

export function CutsManualOrders({
  rows,
  onRowsChange,
  hidden = false,
}: {
  rows: OrderRow[];
  onRowsChange: (next: OrderRow[]) => void;
  hidden?: boolean;
}) {
  if (hidden) return null;

  function updateRow(idx: number, patch: Partial<OrderRow>) {
    onRowsChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Zamówienia (ręcznie)</h2>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.07]"
          onClick={() => onRowsChange(rows.concat({ L: "", B: "", count: "" }))}
        >
          + Dodaj
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[520px] w-full text-sm">
          <thead className="text-white/70">
            <tr>
              <th className="py-2 text-left">L</th>
              <th className="py-2 text-left">B</th>
              <th className="py-2 text-left">szt</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-white/10">
                <td className="py-2 pr-2">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
                    inputMode="numeric"
                    value={r.L}
                    onChange={(e) => updateRow(idx, { L: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
                    inputMode="numeric"
                    value={r.B}
                    onChange={(e) => updateRow(idx, { B: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
                    inputMode="numeric"
                    value={r.count}
                    onChange={(e) => updateRow(idx, { count: e.target.value })}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/80 hover:bg-white/[0.07]"
                    onClick={() => onRowsChange(rows.length <= 1 ? [{ L: "", B: "", count: "" }] : rows.filter((_, i) => i !== idx))}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
