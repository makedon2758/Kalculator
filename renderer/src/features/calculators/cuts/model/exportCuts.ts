import { buildExportData, exportReport } from "@/legacy/raport1d/export";

export async function exportCutsXlsx(params: {
  result: any;
  sheetWidth: number;
  anti: any;
}) {
  const { result, sheetWidth, anti } = params;

  // forcedMap важен для строк “szukaj w złomie” в экспорте
  const antiForExport =
    anti && typeof anti === "object"
      ? { ...anti, forcedMap: result?.forcedMap }
      : { forcedMap: result?.forcedMap };

  const { plan, leftovers } = buildExportData(result, sheetWidth, { anti: antiForExport });

  await exportReport("xlsx", plan, leftovers);
}
