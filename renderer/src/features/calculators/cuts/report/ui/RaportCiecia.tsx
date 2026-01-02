import { useMemo, useState } from "react";

type Tab = "plan" | "resztki" | "zlom" | "zresztek";

function sum(arr: any[], pick: (x: any) => number) {
  return (arr || []).reduce((a, x) => a + (pick(x) || 0), 0);
}

export function RaportCiecia({ result }: { result: any }) {
  const [tab, setTab] = useState<Tab>("plan");

  const summary = useMemo(() => {
    const sheetUsage = result?.sheetUsage ?? [];
    const leftovers = result?.leftovers ?? [];
    const scrapNeeds = result?.scrapNeeds ?? [];
    const scrapProduced = result?.scrapProduced ?? [];
    const usedFromLeftovers = result?.usedFromLeftovers ?? [];

    const sheets = sum(sheetUsage, (g) => Number(g?.sheetCount) || 0);
    const items = sum(sheetUsage, (g) => sum(g?.items ?? [], (it) => Number(it?.count) || 0));
    const zlombNeed = sum(scrapNeeds, (x) => Number(x?.count) || 0);
    const zlombMade = sum(scrapProduced, (x) => Number(x?.count) || 0);

    return {
      sheets,
      items,
      leftovers: leftovers.length,
      zlombNeed,
      zlombMade,
      usedFromLeftovers: usedFromLeftovers.length,
    };
  }, [result]);

  if (result?.error?.type === "tooWide") {
    return (
      <div className="rounded-2xl border border-white/10 bg-red-500/10 p-4 text-sm text-red-200">
        Detal jest za szeroki: L={result.error.L}, B={result.error.B}, W={result.error.sheetWidth}
      </div>
    );
  }

  const sheetUsage = result?.sheetUsage ?? [];
  const leftovers = result?.leftovers ?? [];
  const scrapNeeds = result?.scrapNeeds ?? [];
  const scrapProduced = result?.scrapProduced ?? [];
  const usedFromLeftovers = result?.usedFromLeftovers ?? [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card label="Arkusze" value={summary.sheets} />
        <Card label="Szt." value={summary.items} />
        <Card label="Resztki" value={summary.leftovers} />
        <Card label="Złom (potrzeba)" value={summary.zlombNeed} />
        <Card label="Złom (powstał)" value={summary.zlombMade} />
        <Card label="Z resztek" value={summary.usedFromLeftovers} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "plan"} onClick={() => setTab("plan")}>Plan</TabBtn>
        <TabBtn active={tab === "resztki"} onClick={() => setTab("resztki")}>Resztki</TabBtn>
        <TabBtn active={tab === "zlom"} onClick={() => setTab("zlom")}>Złom</TabBtn>
        <TabBtn active={tab === "zresztek"} onClick={() => setTab("zresztek")}>Z resztek</TabBtn>
      </div>

      {/* Content */}
      {tab === "plan" ? (
        <div className="space-y-3">
          {sheetUsage.map((g: any, idx: number) => (
            <details
              key={g?.key ?? idx}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              open={idx === 0}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/90">
                    {g?.key}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                    Arkusze: {g?.sheetCount ?? 0}
                  </div>
                </div>
              </summary>

              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-white/70">
                    <tr>
                      <th className="p-2 text-left">Formatka</th>
                      <th className="p-2 text-right">szt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(g?.items ?? []).map((it: any, j: number) => (
                      <tr key={j} className="border-t border-white/10">
                        <td className="p-2">{it?.name}</td>
                        <td className="p-2 text-right">{it?.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      ) : tab === "resztki" ? (
        <Box title="Resztki">
          <SimpleTable
            head={["L", "B", "id"]}
            rows={leftovers.map((x: any) => [x?.L, x?.B, x?.id ?? ""])}
          />
        </Box>
      ) : tab === "zlom" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Box title="Złom do znalezienia">
            <SimpleTable
              head={["L", "B (ogon)", "szt", "k"]}
              rows={scrapNeeds.map((x: any) => [x?.L, x?.restB, x?.count, x?.k ?? ""])}
            />
          </Box>

          <Box title="Złom powstały">
            <SimpleTable
              head={["L", "B", "szt"]}
              rows={scrapProduced.map((x: any) => [x?.L, x?.B, x?.count])}
            />
          </Box>
        </div>
      ) : (
        <Box title="Użyto z resztek">
          <div className="space-y-3">
            {usedFromLeftovers.map((u: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-white/90">
                    Resztka: <span className="font-semibold">{u?.L}×{u?.B}</span>
                  </div>
                  <div className="text-xs text-white/60">
                    fallback: {u?.fallback ? "tak" : "nie"} • szt: {u?.count ?? 1}
                  </div>
                </div>

                {Array.isArray(u?.parts) && u.parts.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/[0.04] text-white/70">
                        <tr>
                          <th className="p-2 text-left">donor (L×B)</th>
                          <th className="p-2 text-right">usedB</th>
                          <th className="p-2 text-left">id</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.parts.map((p: any, j: number) => (
                          <tr key={j} className="border-t border-white/10">
                            <td className="p-2">{p?.L}×{p?.B}</td>
                            <td className="p-2 text-right">{p?.usedB}</td>
                            <td className="p-2">{p?.id ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Box>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white/90">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      className={[
        "rounded-xl border px-3 py-2 text-sm",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Box({ title, children }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 text-sm font-semibold text-white/90">{title}</div>
      {children}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: any[]; rows: any[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.04] text-white/70">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-2 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/10">
              {r.map((c, j) => (
                <td key={j} className="p-2">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
