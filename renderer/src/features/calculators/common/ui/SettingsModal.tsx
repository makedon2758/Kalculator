import type { ReactNode } from "react";

export function SettingsModal({
  open,
  title,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * md: стандартное окно (как было)
   * xl: шире/выше
   * full: почти на весь экран (для больших таблиц)
   */
  size?: "md" | "xl" | "full";
  children: ReactNode;
}) {
  if (!open) return null;

  const frameClass =
    size === "full"
      ? "absolute inset-3 md:inset-6"
      : size === "xl"
      ? "absolute left-1/2 top-1/2 w-[min(1180px,96vw)] -translate-x-1/2 -translate-y-1/2"
      : "absolute left-1/2 top-1/2 w-[min(820px,92vw)] -translate-x-1/2 -translate-y-1/2";

  const bodyClass = size === "full" ? "flex-1 overflow-auto p-4 md:p-6" : "max-h-[70vh] overflow-auto p-6";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className={frameClass}>
        <div
          className={
            "h-full rounded-2xl border border-white/10 bg-[#0B0C15] shadow-2xl" +
            (size === "full" ? " flex flex-col" : "")
          }
        >
          <div
            className={
              "flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 md:px-6 md:py-4" +
              (size === "full" ? " shrink-0" : "")
            }
          >
            <div className="text-lg font-semibold text-white">{title}</div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.08]"
              onClick={onClose}
            >
              Zamknij
            </button>
          </div>

          <div className={bodyClass}>{children}</div>
        </div>
      </div>
    </div>
  );
}
