// Typings for legacy ESM modules (minimal, but correct)

declare module "@/legacy/raport1d/export" {
  export function ensureXLSX(): Promise<any>;
  export function buildExportData(
    result: any,
    sheetWidth?: number,
    opts?: any
  ): { plan: any[][]; leftovers: any[][] };

  export function exportReport(
    fmt: string,
    plan: any[][],
    leftovers: any[][]
  ): Promise<void>;
}

declare module "@/legacy/raport1d/import" {
  export type GridData = { headers: string[]; rows: any[][] };
  export type Order = { L: number; B: number; count: number };
  export function setupImport(opts: {
    buttonId: string;
    inputId: string;
    onGrid?: (grid: GridData) => void;
    onOrders?: (orders: Order[]) => void;
  }): void;
}
