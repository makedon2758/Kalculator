import { CutsPage } from "../cuts/ui/CutsPage";
import { MatyPage } from "../maty/ui/MatyPage";
import { StopniePage } from "../stopnie/ui/StopniePage";
import { useLsState } from "@/shared/settings/useLsState";

type CalcKey = "cuts" | "maty" | "stopnie";

const CALCS: { key: CalcKey; label: string }[] = [
  { key: "cuts", label: "Kalkulator (1D)" },
  { key: "maty", label: "Kalkulator z mat" },
  { key: "stopnie", label: "Stopnie" },
];

export function CalculatorHubPage() {
  const [active, setActive] = useLsState<CalcKey>("ui_calc_active", "cuts");

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 gap-3">
        {CALCS.map((c) => {
          const on = c.key === active;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                on ? "bg-white/10" : "text-white/70 hover:text-white",
              ].join(" ")}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {active === "cuts" ? <CutsPage /> : active === "maty" ? <MatyPage /> : <StopniePage />}
    </div>
  );
}
