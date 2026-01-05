import { useRef } from "react";

export function CutsToolbar({
  hasImport,
  onPickFile,
  onOpenTable,
  onExportXlsx,
  onCalc,
  onOpenSettings,
}: {
  hasImport: boolean;
  onPickFile: (file: File) => Promise<void>;
  onOpenTable: () => void;
  onExportXlsx: () => void;
  onCalc: () => void;
  onOpenSettings: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xls,.xlsx,.txt"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // reset so selecting same file triggers change again
          e.currentTarget.value = "";
          if (!file) return;
          await onPickFile(file);
        }}
      />

      <button
        type="button"
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.07]"
        onClick={() => fileRef.current?.click()}
      >
        Import
      </button>

      <button
        type="button"
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.07] disabled:opacity-40"
        onClick={onOpenTable}
        disabled={!hasImport}
      >
        Tabela
      </button>

      <button
        type="button"
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.07]"
        onClick={onExportXlsx}
      >
        Eksport XLSX
      </button>

      <button
        type="button"
        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
        onClick={onCalc}
      >
        Oblicz
      </button>

      <button
        type="button"
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.07]"
        onClick={onOpenSettings}
      >
        Ustawienia
      </button>
    </div>
  );
}
