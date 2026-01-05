// Legacy public entrypoint (kept for backward compatible imports)
// Split into smaller modules under ./import/

export { setupImport } from './import/setup.js';

// The exports below are not required by the UI today,
// but are useful for reuse in future calculators (Stopnie/Maty/etc.).
export { readFileAsGrid } from './import/readers.js';
export { isStepRowLikeStopnie, stripStopnieRowsFromGrid } from './import/stopnieFilter.js';
export { detectLBQCols, rowsToOrders } from './import/orders.js';
