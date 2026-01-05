// Legacy public entrypoint (kept for backward compatible imports)
// Splitted into smaller modules:
//  - ./export/cuts.js : Raport cięcia (buildExportData + exportXLSX)
//  - ./export/maty.js : Maty exporter

export { ensureXLSX, buildExportData, exportXLSX, exportReport } from './export/cuts.js';
export { exportMatyXLSX } from './export/maty.js';
