export function normalizeOrders(
  orders: Array<{ L: number; B: number; count: number }>,
  sheetWidth: number
): Array<{ L: number; B: number; count: number } & Record<string, any>>;

export function bestPatternForL(
  demandMap: Map<number, number>,
  W: number,
  minLeftover: number
): { waste: number; take: Map<number, number> } | null;

export function capLeftoverDonors(
  targetB: number,
  orderL: number,
  combo: any,
  anti: any
): any;

export function capOgonekDonors(
  origB: number,
  orderL: number,
  combo: any,
  anti: any
): any;

export function calculateCuts(
  orders: Array<{ L: number; B: number; count: number }>,
  opts: {
    sheetWidth?: number;
    toleranceL?: number;
    allowFallback?: boolean;
    minLeftover?: number;
    tailWantedB?: number;
    orderByRemainder?: boolean;
    anti?: {
      enabled?: boolean;
      minLNoCut?: number | null;
      limitMergeB?: number | null;
      maxMergeK?: number | null;
      lastNoCutB?: number | null;
    };
  }
): any;
