// Typings for legacy ESM modules (minimal, but correct)

declare module "@/legacy/raport1d/export" {
  export function ensureXLSX(): Promise<any>;
  export function buildExportData(
    result: any,
    sheetWidth?: number,
    opts?: any
  ): { plan: any[][]; leftovers: any[][] };

  // Optional legacy exporter used by the "Maty" calculator.
  // (Not wired in UI yet, but we keep typings for future reuse.)
  export function exportMatyXLSX(
    mats: any[],
    cfg?: any,
    srcInfo?: string
  ): Promise<void>;

  export function exportReport(
    fmt: string,
    plan: any[][],
    leftovers: any[][],
    fileName?: string
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
