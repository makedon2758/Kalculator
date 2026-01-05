import { buildExportData, exportReport } from "@/legacy/raport1d/export";
import type { GridView } from "../core/gridTypes";

export async function exportCutsXlsx(params: {
  result: any;
  sheetWidth: number;
  anti: any;
  gridView?: GridView | null;
  fileName?: string;
}) {
  const { result, sheetWidth, anti, gridView, fileName } = params;

  const antiForExport =
    anti && typeof anti === "object"
      ? { ...anti, forcedMap: result?.forcedMap }
      : { forcedMap: result?.forcedMap };

  const { plan, leftovers } = buildExportData(result, sheetWidth, {
    anti: antiForExport,
    gridView: gridView ?? undefined,
  });

  await exportReport("xlsx", plan, leftovers, fileName);
}
