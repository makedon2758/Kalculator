import type { ReactNode } from "react";
import { TABS, type TabKey } from "../tabs";
import "./AppShell.css";

export function AppShell({
  version,
  tab,
  onTabChange,
  children,
}: {
  version: string;
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}) {
  const currentLabel = TABS.find((x) => x.key === tab)?.label ?? "";

  return (
    <div className="min-h-screen bg-[#0B0C15] text-white">
      <div className="flex min-h-screen">
        {/* Sidebar (только один!) */}
        <aside className="w-[280px] shrink-0 border-r border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4">
            <div className="text-lg font-semibold">Kalkulator Cięcia</div>
            <div className="text-xs text-white/60">{version}</div>
          </div>

          <nav className="grid gap-2">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left font-semibold transition",
                    active
                      ? "border-lime-400/40 bg-lime-400/10 shadow-[0_0_0_1px_rgba(163,230,53,0.25)]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <header className="border-b border-white/10 bg-white/[0.02] px-6 py-4">
            <div className="text-xl font-semibold">{currentLabel}</div>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
