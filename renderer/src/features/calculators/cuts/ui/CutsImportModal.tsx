import type { GridView } from "../core/gridTypes";
import { SettingsModal } from "../../common/ui/SettingsModal";
import { OrdersGrid } from "./OrdersGrid/OrdersGrid";

export function CutsImportModal({
  open,
  fileName,
  grid,
  onGridChange,
  onClose,
  onApply,
}: {
  open: boolean;
  fileName?: string | null;
  grid: GridView;
  onGridChange: (next: GridView) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <SettingsModal open={open} title="Tabela z pliku" onClose={onClose} size="full">
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-white/80">
            {fileName ? (
              <>
                Plik: <span className="font-semibold text-white">{fileName}</span>
              </>
            ) : (
              <>Tabela importu</>
            )}
          </div>
          <div className="text-xs text-white/55">
            Dwuklik nagłówka = zmień nazwę • Przeciągnij krawędź = szerokość • Wklej z Excela (TAB/ENTER)
          </div>
        </div>

        <div className="flex-1">
          <OrdersGrid grid={grid} onChange={onGridChange} maxHeightClass="h-[calc(100vh-220px)]" />
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-white/80 hover:bg-white/[0.07]"
            onClick={onClose}
          >
            Zamknij
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
            onClick={onApply}
          >
            Zastosuj i oblicz
          </button>
        </div>
      </div>
    </SettingsModal>
  );
}
